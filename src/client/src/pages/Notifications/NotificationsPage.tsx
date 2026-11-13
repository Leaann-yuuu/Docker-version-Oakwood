import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import GateAccessService from "../../services/GateAccessService";
import type { NotificationItem, UpdateRequestItem } from "../../interfaces/GateInterface";

const ClientNotificationsSkeleton = () => (
  <div className="animate-pulse space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700 bg-white dark:bg-zinc-800 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 w-72 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3.5 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="h-8 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    ))}
  </div>
);

const formatDateTime = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? dateString
      : d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
  } catch {
    return dateString;
  }
};

const formatDateOnly = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? dateString
      : d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
  } catch {
    return dateString;
  }
};

const getResidentName = (request?: UpdateRequestItem | null) => {
  if (!request?.resident) return "Subdivision Resident";
  const r = request.resident;
  const full = `${r.first_name || ""} ${r.last_name || ""}`.trim();
  return full || r.username || "Resident";
};

const NotificationsPage = () => {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [allRequests, setAllRequests] = useState<UpdateRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"approved" | "rejected" | null>(null);

    // Detail modal state
    const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<UpdateRequestItem | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([
            GateAccessService.loadNotifications(1),
            GateAccessService.loadUpdateRequests(1)
        ])
            .then(([notifRes, reqRes]) => {
                setItems(notifRes.data.notifications.data ?? []);
                setAllRequests(reqRes.data.requests.data ?? []);
            })
            .catch((e) => console.error(e))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const handleMarkAllRead = async () => {
        setLoading(true);
        await GateAccessService.markAllNotificationsRead();
        load();
        window.dispatchEvent(new Event('notifications_updated'));
        setLoading(false);
    };

    const markRead = async (id: number) => {
        setLoading(true);
        await GateAccessService.markNotificationRead(id);
        load();
        window.dispatchEvent(new Event('notifications_updated'));
    };

    const deleteNotification = async (id: number) => {
        setLoading(true);
        try {
            await GateAccessService.deleteNotification(id);
            window.dispatchEvent(new Event('notifications_updated'));
        } catch (e) {
            console.error(e);
        } finally {
            load();
        }
    };

    const deleteProcessedHistory = async () => {
        if (!confirm("Are you sure you want to delete all processed history notifications?")) return;
        setLoading(true);
        try {
            const readItems = items.filter((item) => item.is_read);
            await Promise.all(readItems.map((item) => GateAccessService.deleteNotification(item.notification_id)));
            window.dispatchEvent(new Event('notifications_updated'));
        } catch (e) {
            console.error(e);
        } finally {
            load();
        }
    };

    const reviewRequest = async (requestId: number, status: "approved" | "rejected", notificationId: number) => {
        setLoading(true);
        try {
            await GateAccessService.reviewUpdateRequest(requestId, { status });
            await GateAccessService.markNotificationRead(notificationId);
            window.dispatchEvent(new Event('notifications_updated'));
            if (selectedRequest && selectedRequest.update_request_id === requestId) {
                setSelectedRequest({ ...selectedRequest, status });
            }
        } catch (e) {
            console.error(e);
        } finally {
            load();
            setSelectedNotification(null);
        }
    };

    const handleOpenDetails = async (notification: NotificationItem) => {
        setSelectedNotification(notification);

        // Mark as read automatically when opening details
        if (!notification.is_read) {
            try {
                await GateAccessService.markNotificationRead(notification.notification_id);
                window.dispatchEvent(new Event('notifications_updated'));
                setItems((prev) =>
                    prev.map((n) =>
                        n.notification_id === notification.notification_id
                            ? { ...n, is_read: true }
                            : n
                    )
                );
            } catch (_) {}
        }

        const requestIdMatch = notification.message.match(/\[REQUEST_ID:(\d+)\]/);
        let requestId = requestIdMatch ? parseInt(requestIdMatch[1], 10) : null;

        if (!requestId && (notification.title.includes("Guest Access") || notification.title.includes("Request"))) {
            const matchedReq = allRequests.find((r) =>
                (notification.message.toLowerCase().includes(r.requested_changes?.guest_name?.toLowerCase() ?? "___xyz___")) ||
                (notification.user_id && r.user_id === notification.user_id)
            );
            if (matchedReq) {
                requestId = matchedReq.update_request_id;
            }
        }

        if (requestId) {
            const existing = allRequests.find((r) => r.update_request_id === requestId);
            if (existing) {
                setSelectedRequest(existing);
            } else {
                setLoadingDetails(true);
                try {
                    const res = await GateAccessService.getRequestDetails(requestId);
                    if (res.data?.request) {
                        setSelectedRequest(res.data.request);
                    }
                } catch (e) {
                    console.error("Failed to load request details:", e);
                } finally {
                    setLoadingDetails(false);
                }
            }
        } else {
            setSelectedRequest(null);
        }
    };

    const displayedItems = items.filter((item) => {
        if (!statusFilter) return true;

        const requestIdMatch = item.message.match(/\[REQUEST_ID:(\d+)\]/);
        let requestId = requestIdMatch ? parseInt(requestIdMatch[1], 10) : null;
        if (!requestId) {
            const matchedReq = allRequests.find((r) =>
                (item.message.toLowerCase().includes(r.requested_changes?.guest_name?.toLowerCase() ?? "___xyz___")) ||
                (item.user_id && r.user_id === item.user_id)
            );
            if (matchedReq) requestId = matchedReq.update_request_id;
        }

        const matchedReq = requestId ? allRequests.find((r) => r.update_request_id === requestId) : null;
        const status = (matchedReq?.status || (item.message.toLowerCase().includes("approved") ? "approved" : (item.message.toLowerCase().includes("rejected") ? "rejected" : "pending"))).toLowerCase();

        return status === statusFilter;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        Notifications
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        View gate security alerts and guest pass requests
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === "approved" ? null : "approved")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 ${
                            statusFilter === "approved"
                                ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        }`}
                    >
                        ✓ Approved Pass
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === "rejected" ? null : "rejected")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 ${
                            statusFilter === "rejected"
                                ? "bg-rose-600 text-white ring-2 ring-rose-400"
                                : "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
                        }`}
                    >
                        ✕ Disapproved
                    </button>

                    <button
                        type="button"
                        onClick={deleteProcessedHistory}
                        title="Clear History Log"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-95 dark:bg-amber-600 dark:hover:bg-amber-500"
                    >
                        🗑️ Trash History
                    </button>

                    {statusFilter && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter(null)}
                            className="ml-1 text-xs text-zinc-400 hover:underline"
                        >
                            Clear Filter
                        </button>
                    )}

                    {items.some((item) => !item.is_read) && (
                        <button type="button" onClick={handleMarkAllRead} className="ml-2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">Mark all as read</button>
                    )}
                </div>
            </div>

            {loading ? <ClientNotificationsSkeleton /> : (
                <div className="space-y-4">
                    {displayedItems.length > 0 ? displayedItems.map((notification) => {
                        const requestIdMatch = notification.message.match(/\[REQUEST_ID:(\d+)\]/);
                        let requestId = requestIdMatch ? parseInt(requestIdMatch[1], 10) : null;

                        if (!requestId && (notification.title.includes("Guest Access") || notification.title.includes("Request"))) {
                            const matchedReq = allRequests.find((r) =>
                                (notification.message.toLowerCase().includes(r.requested_changes?.guest_name?.toLowerCase() ?? "___xyz___")) ||
                                (notification.user_id && r.user_id === notification.user_id)
                            );
                            if (matchedReq) {
                                requestId = matchedReq.update_request_id;
                            }
                        }

                        const matchedReq = requestId ? allRequests.find((r) => r.update_request_id === requestId) : null;
                        const reqStatus = matchedReq ? matchedReq.status.toLowerCase() : (notification.message.toLowerCase().includes("approved") ? "approved" : (notification.message.toLowerCase().includes("rejected") ? "rejected" : "pending"));
                        const isPending = reqStatus === "pending";

                        const cleanMessage = notification.message.replace(/\s*\[REQUEST_ID:\d+\]/, '');

                        return (
                            <div
                                key={notification.notification_id}
                                onClick={() => handleOpenDetails(notification)}
                                className={`group rounded-xl border p-4 transition-all duration-200 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md ${
                                    notification.is_read
                                        ? "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                                        : "border-blue-300/80 bg-blue-50/70 dark:border-blue-700/60 dark:bg-blue-900/20"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
                                                    {notification.title}
                                                </h3>
                                                {!notification.is_read ? (
                                                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                                ) : (
                                                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                                                        HISTORY LOG
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action Buttons OR Status Badge + Details + Trash Icon */}
                                            <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                {/* Details Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDetails(notification)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 active:scale-95 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/60"
                                                >
                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    Details
                                                </button>

                                                {requestId && isPending ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => reviewRequest(requestId!, "approved", notification.notification_id)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                                                        >
                                                            ✓ Approve Pass
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => reviewRequest(requestId!, "rejected", notification.notification_id)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
                                                        >
                                                            ✕ Disapprove
                                                        </button>
                                                    </>
                                                ) : reqStatus === "approved" ? (
                                                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                        ✓ APPROVED
                                                    </span>
                                                ) : reqStatus === "rejected" ? (
                                                    <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                                                        ✕ DISAPPROVED
                                                    </span>
                                                ) : null}

                                                {/* Trash / Delete button for Notification item */}
                                                <button
                                                    type="button"
                                                    onClick={() => deleteNotification(notification.notification_id)}
                                                    title="Delete notification"
                                                    className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 text-zinc-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{cleanMessage}</p>
                                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                                            <span>{formatDateTime(notification.created_at)}</span>
                                            <span className="text-blue-500 font-medium group-hover:underline flex items-center gap-1">
                                                Click to view full details
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </span>
                                        </div>
                                    </div>

                                    {!notification.is_read && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markRead(notification.notification_id);
                                            }}
                                            className="shrink-0 rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
                                        >
                                            Mark Read
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="rounded-xl border border-zinc-200 py-8 text-center text-zinc-500 dark:border-zinc-700">
                            No notifications found
                        </div>
                    )}
                </div>
            )}

            {/* ── Guest Access Pass / Notification Details Modal ── */}
            {selectedNotification && createPortal(
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4">
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                            onClick={() => setSelectedNotification(null)}
                        />

                        {/* Modal Container */}
                        <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            {/* Modal Header */}
                            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                            {selectedRequest
                                                ? "Guest Access Pass Request Details"
                                                : selectedNotification.title}
                                        </h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {selectedRequest
                                                ? "Security gate clearance and visitor authorization"
                                                : "Security system alert notification"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {selectedRequest && (
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                                                selectedRequest.status === "approved"
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                    : selectedRequest.status === "rejected"
                                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                            }`}
                                        >
                                            {selectedRequest.status}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedNotification(null)}
                                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="mt-5 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                                {loadingDetails ? (
                                    <div className="py-12 text-center text-sm text-zinc-500">
                                        Loading request details...
                                    </div>
                                ) : selectedRequest ? (
                                    <>
                                        {/* Resident (Host) Section */}
                                        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                Host Resident Information
                                            </h4>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">RESIDENT NAME</span>
                                                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                        {getResidentName(selectedRequest)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">HOUSE / ADDRESS</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.resident?.address || "Registered Resident"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">CONTACT NUMBER</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.resident?.contact_number || "Not specified"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">DATE REQUESTED</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {formatDateTime(selectedRequest.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Guest Information Section */}
                                        <div className="rounded-xl border border-purple-200/80 bg-purple-50/50 p-4 dark:border-purple-900/30 dark:bg-purple-950/20">
                                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                Authorized Guest Details
                                            </h4>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">GUEST FULL NAME</span>
                                                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                        {selectedRequest.requested_changes?.guest_name || "Visitor"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">AGE</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.requested_changes?.guest_age
                                                            ? `${selectedRequest.requested_changes.guest_age} years old`
                                                            : "Not specified"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">CONTACT NUMBER</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.requested_changes?.guest_contact_number || "Not specified"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">GUEST ADDRESS</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.requested_changes?.guest_address || "Not specified"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Vehicle Information Section */}
                                        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 16l-2-6H7L5 16m14 0a2 2 0 01-2 2H7a2 2 0 01-2-2m14 0H5m14 0a2 2 0 002-2v-3a2 2 0 00-2-2H5a2 2 0 00-2 2v3a2 2 0 002 2m2 4h.01M17 20h.01" />
                                                </svg>
                                                Vehicle Clearance Details
                                            </h4>
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">PLATE NUMBER</span>
                                                    <span className="inline-block mt-0.5 rounded-md border border-purple-300 bg-purple-50 px-2.5 py-1 font-mono text-sm font-bold text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                                        {selectedRequest.requested_changes?.guest_plate_number || "NO VEHICLE"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">CAR MODEL</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.requested_changes?.guest_car_model || "Not specified"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">CAR COLOR</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.requested_changes?.guest_car_color || "Not specified"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Schedule & Reason Section */}
                                        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                Access Schedule & Reason
                                            </h4>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">EXPECTED ACCESS DATE</span>
                                                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                        {formatDateOnly(selectedRequest.requested_changes?.access_date)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-zinc-400">PURPOSE OF VISIT</span>
                                                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                                        {selectedRequest.requested_changes?.access_reason || "Guest Access Pass Request"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* General Notification Details (Non-Guest Pass) */
                                    <div className="space-y-4">
                                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                                            <span className="block text-xs font-semibold text-zinc-400">MESSAGE CONTENT</span>
                                            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                                                {selectedNotification.message.replace(/\s*\[REQUEST_ID:\d+\]/, '')}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-zinc-400">
                                            <span>Received: {formatDateTime(selectedNotification.created_at)}</span>
                                            <span>Notification ID: #{selectedNotification.notification_id}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                                <div className="text-xs text-zinc-400">
                                    {selectedRequest
                                        ? `Pass Request ID: #${selectedRequest.update_request_id}`
                                        : `Notification ID: #${selectedNotification.notification_id}`}
                                </div>

                                <div className="flex items-center gap-2">
                                    {selectedRequest && selectedRequest.status === "pending" && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    reviewRequest(
                                                        selectedRequest.update_request_id,
                                                        "approved",
                                                        selectedNotification.notification_id
                                                    )
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                                            >
                                                ✓ Approve Pass
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    reviewRequest(
                                                        selectedRequest.update_request_id,
                                                        "rejected",
                                                        selectedNotification.notification_id
                                                    )
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
                                            >
                                                ✕ Disapprove
                                            </button>
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setSelectedNotification(null)}
                                        className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default NotificationsPage;
