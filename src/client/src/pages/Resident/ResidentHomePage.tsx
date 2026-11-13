import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import GateAccessService from "../../services/GateAccessService";
import VisitorService from "../../services/VisitorService";
import type { GateLog, NotificationItem, UpdateRequestItem } from "../../interfaces/GateInterface";
import type { VisitorRequestItem } from "../../interfaces/VisitorInterface";
import { useAuth } from "../../contexts/AuthContext";
import Spinner from "../../components/Spinner/Spinner";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { formatPlateInput } from "../../utils/plateOcr";
import { resolveCaptureUrl } from "../GateLogs/GateLogsPage";

type ResidentModal = "notifications" | "logs" | "guest" | null;

type GuestForm = {
    guest_name: string;
    guest_age: string;
    guest_contact_number: string;
    guest_address: string;
    guest_plate_number: string;
    guest_car_model: string;
    guest_car_color: string;
    access_date: string;
    access_reason: string;
};

const blankGuestForm: GuestForm = {
    guest_name: "",
    guest_age: "",
    guest_contact_number: "",
    guest_address: "",
    guest_plate_number: "",
    guest_car_model: "",
    guest_car_color: "",
    access_date: "",
    access_reason: "",
};

const ResidentDashboardSkeleton = () => (
    <div className="flex h-full w-full flex-1 flex-col gap-6 animate-pulse">
        {/* Header */}
        <div className="space-y-2">
            <div className="h-8 w-60 rounded-xl bg-zinc-200/70" />
            <div className="h-4 w-80 rounded bg-zinc-200/50" />
        </div>

        {/* 3 Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-zinc-200/60 bg-white/80 p-6 space-y-4 shadow-2xs">
                    <div className="flex justify-between items-center">
                        <div className="h-4 w-20 rounded bg-zinc-200/60" />
                        <div className="h-5 w-5 rounded bg-zinc-200/60" />
                    </div>
                    <div className="h-7 w-40 rounded bg-zinc-200/60" />
                    <div className="h-3.5 w-24 rounded bg-zinc-200/60" />
                </div>
            ))}
        </div>

        {/* Grid layout for Recent Notifications & Quick Links */}
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Notifications Column */}
            <div className="rounded-2xl border border-zinc-200/60 bg-white/80 p-6 lg:col-span-2 space-y-4 shadow-2xs">
                <div className="flex justify-between items-center mb-2">
                    <div className="h-5 w-36 rounded bg-zinc-200/60" />
                    <div className="h-4 w-14 rounded bg-zinc-200/60" />
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-28 rounded bg-zinc-200/60" />
                        </div>
                        <div className="h-3.5 w-full rounded bg-zinc-200/60" />
                        <div className="h-3 w-3/4 rounded bg-zinc-200/60" />
                    </div>
                ))}
            </div>

            {/* Quick Links Column */}
            <div className="rounded-2xl border border-zinc-200/60 bg-white/80 p-6 space-y-4 shadow-2xs">
                <div className="h-5 w-24 rounded bg-zinc-200/60 mb-2" />
                {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50">
                        <div className="h-10 w-10 rounded-xl bg-zinc-200/60 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 w-24 rounded bg-zinc-200/60" />
                            <div className="h-3 w-16 rounded bg-zinc-200/60" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const ResidentHomePage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<GateLog[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [requests, setRequests] = useState<UpdateRequestItem[]>([]);
    const [urgentWalkins, setUrgentWalkins] = useState<VisitorRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [submittingGuest, setSubmittingGuest] = useState(false);
    const [walkinActionLoading, setWalkinActionLoading] = useState(false);
    const [activeModal, setActiveModal] = useState<ResidentModal>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    const [openRequest, setOpenRequest] = useState<number | null>(null);
    const [guestForm, setGuestForm] = useState<GuestForm>(blankGuestForm);
    const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const loadDashboardData = useCallback((showInitialLoading = false) => {
        if (showInitialLoading) setLoading(true);

        return Promise.all([
            GateAccessService.myGateLogs(1),
            GateAccessService.loadNotifications(1),
            VisitorService.loadResidentRequests(1, "PENDING"),
        ])
            .then(([logsRes, notifRes, visitorRes]) => {
                setLogs(logsRes.data.logs.data ?? []);
                setNotifications(notifRes.data.notifications.data ?? []);
                const walkins = (visitorRes.data.requests.data ?? []).filter(
                    (r) => r.requested_by === "guard" && r.status === "PENDING"
                );
                setUrgentWalkins(walkins);
            })
            .catch((error) => {
                console.error("Failed to load resident dashboard data:", error);
            })
            .finally(() => {
                if (showInitialLoading) setLoading(false);
            });
    }, []);

    const handleWalkinResponse = async (requestId: number, response: "CONFIRM" | "REJECT") => {
        setWalkinActionLoading(true);
        try {
            const res = await VisitorService.residentRespond(requestId, { response });
            setNotice({
                type: "success",
                message: res.data.message || `Visitor visit ${response === "CONFIRM" ? "confirmed" : "rejected"}.`,
            });
            await loadDashboardData();
        } catch (err: any) {
            setNotice({
                type: "error",
                message: err.response?.data?.message || "Failed to update visitor request.",
            });
        } finally {
            setWalkinActionLoading(false);
        }
    };

    const loadRequests = () => {
        setRequestsLoading(true);
        GateAccessService.myUpdateRequests(1)
            .then((res) => setRequests(res.data.requests.data ?? []))
            .finally(() => setRequestsLoading(false));
    };

    useEffect(() => {
        void loadDashboardData(true);
    }, [loadDashboardData]);

    useEffect(() => {
        if (activeModal === "guest") loadRequests();
    }, [activeModal]);

    if (loading) return <ResidentDashboardSkeleton />;

    const displayName = [user?.user?.first_name, user?.user?.last_name].filter(Boolean).join(" ") || "Resident";
    const recentNotifications = notifications.slice(0, 5);
    const lastEntry = logs.find((log) => log.direction === "IN");
    const lastExit = logs.find((log) => log.direction === "OUT");
    const unauthorizedCount = logs.filter((log) => log.status === "unauthorized").length;
    const guestRequests = requests.filter((request) => request.requested_changes?.request_type === "guest_access");


    const markAllRead = async () => {
        await GateAccessService.markAllNotificationsRead();
        await loadDashboardData();
        window.dispatchEvent(new Event('notifications_updated'));
    };

    const markRead = async (id: number) => {
        await GateAccessService.markNotificationRead(id);
        await loadDashboardData();
        window.dispatchEvent(new Event('notifications_updated'));
    };

    const submitGuestAccess = async (event: FormEvent) => {
        event.preventDefault();
        setSubmittingGuest(true);
        setNotice(null);

        try {
            await GateAccessService.submitUpdateRequest({
                request_type: "guest_access",
                ...guestForm,
                guest_plate_number: guestForm.guest_plate_number.toUpperCase(),
                guest_age: guestForm.guest_age || undefined,
            });
            setGuestForm(blankGuestForm);
            setNotice({ type: "success", message: "Guest access request submitted for admin review." });
            loadRequests();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            setNotice({ type: "error", message: err.response?.data?.message ?? "Failed to submit guest access request." });
        } finally {
            setSubmittingGuest(false);
        }
    };

    return (
        <div className="flex h-full w-full flex-1 flex-col gap-6 text-zinc-900 dark:text-zinc-100">
            {/* ── Header ── */}
            <div className="flex flex-col gap-4 border-b border-zinc-200/80 dark:border-white/10 pb-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs shrink-0">
                            <LockIcon className="h-5 w-5 text-lime-400 dark:text-lime-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Welcome, {displayName}!</h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Oakwood Subdivision &bull; Resident Access &amp; Gate Automation Portal</p>
                        </div>
                    </div>
                    {/* Date & Time display */}
                    <div className="flex items-center gap-2.5 rounded-full bg-white/85 dark:bg-zinc-800/85 border border-zinc-200/80 dark:border-white/10 px-4 py-2 text-zinc-700 dark:text-zinc-300 shadow-xs backdrop-blur-md self-start md:self-auto">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-mono text-xs font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">
                            {currentTime.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} &bull; {currentTime.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Flow 2: Urgent Incoming Walk-in Alerts at Gate ── */}
            {urgentWalkins.length > 0 && (
                <div className="rounded-2xl border-2 border-rose-500 bg-rose-500/10 dark:bg-rose-950/40 p-5 shadow-lg backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />
                        <h2 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                            Urgent Gate Alert: Visitor Requesting Entry ({urgentWalkins.length})
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {urgentWalkins.map((walkin) => (
                            <div key={walkin.request_id} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-zinc-400">#{walkin.request_id}</span>
                                        <h3 className="text-base font-black text-zinc-900 dark:text-white">
                                            {walkin.visitor?.full_name}
                                        </h3>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                                            At Subdivision Gate
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                                        <span className="font-semibold text-zinc-900 dark:text-white">Purpose:</span> {walkin.purpose} &bull; <span className="font-semibold">Arrival:</span> {walkin.visit_time}
                                    </p>
                                    {walkin.visitor?.vehicle_plate && (
                                        <p className="text-xs text-zinc-500 font-mono">
                                            Vehicle: {walkin.visitor.vehicle_plate} ({walkin.visitor.vehicle_type || "Vehicle"})
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        disabled={walkinActionLoading}
                                        onClick={() => void handleWalkinResponse(walkin.request_id, "REJECT")}
                                        className="py-2 px-4 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-bold text-xs transition cursor-pointer"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        disabled={walkinActionLoading}
                                        onClick={() => void handleWalkinResponse(walkin.request_id, "CONFIRM")}
                                        className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-700/20 transition cursor-pointer"
                                    >
                                        Confirm Entry
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Top Section: Stats ── */}
            <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                    <SummaryCard
                        title="Last Entry"
                        icon={<BarIcon className="text-emerald-600 dark:text-emerald-400" />}
                        value={lastEntry ? formatTime(lastEntry.logged_at) : "No entries"}
                        sub={lastEntry ? formatDate(lastEntry.logged_at) : "No recent activity"}
                        badge={lastEntry ? "AUTHORIZED" : undefined}
                        badgeClass="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"
                    />
                    <SummaryCard
                        title="Last Exit"
                        icon={<ExitIcon className="text-blue-600 dark:text-blue-400" />}
                        value={lastExit ? formatTime(lastExit.logged_at) : "No exits"}
                        sub={lastExit ? formatDate(lastExit.logged_at) : "No recent activity"}
                        badge={lastExit ? "AUTHORIZED" : undefined}
                        badgeClass="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800"
                    />
                    <SummaryCard
                        title="Access Clearance"
                        icon={<LockIcon className="text-zinc-700 dark:text-zinc-300" />}
                        value="Authorized"
                        sub={`${logs.length} Total Passes`}
                        badge={unauthorizedCount > 0 ? `${unauthorizedCount} unauth. attempts` : "Active Resident Pass"}
                        badgeClass={unauthorizedCount > 0 ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800" : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"}
                        valueClass="text-emerald-600 dark:text-emerald-400 font-black"
                    />
                </div>

                {/* Subdivision Gate Status Banner */}
                <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                    <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-xl bg-lime-50 dark:bg-lime-950/40 border border-lime-200 dark:border-lime-900/60 flex items-center justify-center text-lime-700 dark:text-lime-400 shrink-0">
                            <CarIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Boom Barrier &amp; ANPR Gate Status</h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Automated license plate recognition is online at Entrance &amp; Exit gates.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 shadow-2xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Gate Online
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Bottom Section: Notifications & Quick Links ── */}
            <div className="grid gap-6 lg:grid-cols-12">
                <section className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] p-6 lg:col-span-8 transition-colors">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Recent Notifications &amp; Alerts</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Real-time gate passes and community security notices</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveModal("notifications")}
                            className="rounded-xl border border-zinc-200/80 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition shadow-2xs cursor-pointer"
                        >
                            View All
                        </button>
                    </div>
                    {recentNotifications.length > 0 ? (
                        <div className="space-y-3">
                            {recentNotifications.map((notification) => (
                                <NotificationCard key={notification.notification_id} notification={notification} compact />
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-zinc-400 text-sm">No notifications yet. You're all caught up.</div>
                    )}
                </section>

                <aside className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] p-6 lg:col-span-4 flex flex-col justify-between transition-colors">
                    <div>
                        <h2 className="mb-1 text-base font-bold text-zinc-900 dark:text-white">Resident Shortcuts</h2>
                        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">Fast access to key resident features</p>
                        <div className="space-y-2.5">
                            <QuickAction onClick={() => setActiveModal("logs")} icon={<ClipboardIcon />} title="Gate Logs" sub="View full entry & exit timeline" />
                            <QuickAction onClick={() => navigate("/resident/visitors")} icon={<CarIcon />} title="Visitor Passes" sub="Pre-register & manage guests" />
                        </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3.5 border border-zinc-200/70 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400">
                        <p className="font-bold text-zinc-800 dark:text-zinc-200 mb-0.5">Need Gate Assistance?</p>
                        <p>Contact security guard post or admin office through Oakwood Subdivision management office.</p>
                    </div>
                </aside>
            </div>

            <DashboardModal title="Notifications" isOpen={activeModal === "notifications"} onClose={() => setActiveModal(null)} maxWidth="max-w-4xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-zinc-500">Stay updated on gate access alerts and system messages.</p>
                    {notifications.some((item) => !item.is_read) && (
                        <button type="button" onClick={() => void markAllRead()} className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 shadow-xs">
                            Mark all as read
                        </button>
                    )}
                </div>
                <div className="space-y-3 pr-1">
                    {notifications.length > 0 ? notifications.map((notification) => (
                        <NotificationCard key={notification.notification_id} notification={notification} onMarkRead={() => void markRead(notification.notification_id)} />
                    )) : (
                        <EmptyCard text="No notifications. You're all caught up." />
                    )}
                </div>
            </DashboardModal>

            <DashboardModal title="Gate Access Logs" isOpen={activeModal === "logs"} onClose={() => setActiveModal(null)} maxWidth="max-w-6xl">
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <StatMini label="Total Entries Today" value={String(countToday(logs, "IN"))} />
                    <StatMini label="Total Exits Today" value={String(countToday(logs, "OUT"))} />
                    <StatMini label="Unauthorized Attempts" value={String(unauthorizedCount)} danger />
                </div>
                <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
                    {logs.length > 0 ? (
                        <table className="w-full min-w-[760px]">
                            <thead className="border-b border-zinc-200/80 bg-zinc-50">
                                <tr>
                                    <Head>Date & Time</Head>
                                    <Head>Status</Head>
                                    <Head>Access Type</Head>
                                    <Head>Plate Number</Head>
                                    <Head center>Image</Head>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {logs.map((log) => (
                                    <tr key={log.gate_log_id} className="transition hover:bg-zinc-50/60">
                                        <td className="px-6 py-4 text-sm text-zinc-900">
                                            <p className="font-semibold">{formatDate(log.logged_at)}</p>
                                            <p className="text-xs text-zinc-400">{new Date(log.logged_at).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex items-center gap-1.5 font-semibold text-xs rounded-full px-2.5 py-0.5 ${log.status === "authorized" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${log.status === "authorized" ? "bg-emerald-500" : "bg-rose-500"}`} />
                                                {log.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${log.direction === "IN" ? "bg-lime-100 text-lime-800" : "bg-zinc-100 text-zinc-800"}`}>
                                                {log.direction === "IN" ? "Entry" : "Exit"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-sm text-zinc-900">{log.plate_number || "-"}</td>
                                        <td className="px-6 py-4 text-center">
                                            {log.capture_image ? (
                                                <button type="button" onClick={() => setImagePreview(log.capture_image ?? null)} className="text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg transition">
                                                    View
                                                </button>
                                            ) : (
                                                <span className="text-sm text-zinc-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <EmptyCard text="No gate logs found." />
                    )}
                </div>
            </DashboardModal>

            <DashboardModal title="Guest Access" isOpen={activeModal === "guest"} onClose={() => setActiveModal(null)} maxWidth="max-w-5xl">
                {notice && (
                    <div className={`mb-4 rounded-xl border p-4 text-sm font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50/80 text-emerald-900" : "border-rose-200 bg-rose-50/80 text-rose-900"}`}>
                        {notice.message}
                    </div>
                )}

                <form onSubmit={submitGuestAccess} className="space-y-5">
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-600">Your Information (Host)</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <ReadOnlyInfo label="Host Name" value={[user?.user?.first_name, user?.user?.last_name].filter(Boolean).join(" ")} />
                            <ReadOnlyInfo label="Your Vehicle Plate" value={user?.user?.plate_number} />
                        </div>
                    </div>

                    <SectionHeading title="Guest Vehicle Owner Information" />
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Guest Name" name="guest_name" value={guestForm.guest_name} onChange={(value) => setGuestForm({ ...guestForm, guest_name: value })} required placeholder="Full name of the guest vehicle owner" />
                        <Field label="Guest Age" name="guest_age" type="number" value={guestForm.guest_age} onChange={(value) => setGuestForm({ ...guestForm, guest_age: value })} placeholder="Age (optional)" />
                        <Field label="Guest Contact Number" name="guest_contact_number" value={guestForm.guest_contact_number} onChange={(value) => setGuestForm({ ...guestForm, guest_contact_number: value.replace(/\D/g, "").slice(0, 11) })} required maxLength={11} inputMode="numeric" pattern="[0-9]*" placeholder="Mobile number of the guest" />
                        <Field label="Guest Address" name="guest_address" value={guestForm.guest_address} onChange={(value) => setGuestForm({ ...guestForm, guest_address: value })} textarea placeholder="Home address of the guest (optional)" />
                    </div>

                    <SectionHeading title="Guest Vehicle Information" />
                    <div className="grid gap-5 md:grid-cols-3">
                        <Field label="Vehicle Plate Number" name="guest_plate_number" value={guestForm.guest_plate_number} onChange={(value) => setGuestForm({ ...guestForm, guest_plate_number: formatPlateInput(value) })} required placeholder="e.g. ABC1234" mono />
                        <Field label="Car Model" name="guest_car_model" value={guestForm.guest_car_model} onChange={(value) => setGuestForm({ ...guestForm, guest_car_model: value })} required placeholder="Honda Civic 2020" />
                        <Field label="Car Color" name="guest_car_color" value={guestForm.guest_car_color} onChange={(value) => setGuestForm({ ...guestForm, guest_car_color: value })} placeholder="White" />
                    </div>

                    <SectionHeading title="Access Details" />
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Access Date" name="access_date" type="date" value={guestForm.access_date} onChange={(value) => setGuestForm({ ...guestForm, access_date: value })} required />
                        <Field label="Reason for Access" name="access_reason" value={guestForm.access_reason} onChange={(value) => setGuestForm({ ...guestForm, access_reason: value })} required textarea placeholder="Family visit, delivery, service provider, etc." />
                    </div>

                    <button type="submit" disabled={submittingGuest} className="w-full rounded-xl bg-zinc-900 px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {submittingGuest ? "Submitting..." : "Submit Guest Access Request"}
                    </button>
                </form>

                <div className="mt-8 border-t border-zinc-200/80 pt-6">
                    <h3 className="text-base font-bold text-zinc-900">Your Guest Access Requests</h3>
                    <div className="mt-4 space-y-3 pr-1">
                        {requestsLoading ? (
                            <Spinner size="md" />
                        ) : guestRequests.length > 0 ? guestRequests.map((request) => (
                            <RequestCard key={request.update_request_id} request={request} onOpen={() => setOpenRequest(request.update_request_id)} />
                        )) : (
                            <EmptyCard text="No guest access requests yet. Submit your first request above." />
                        )}
                    </div>
                </div>
            </DashboardModal>

            <RequestDetailModal 
                isOpen={!!openRequest}
                request={requests.find((request) => request.update_request_id === openRequest)} 
                onClose={() => setOpenRequest(null)} 
            />

            <ImagePreviewModal src={imagePreview} onClose={() => setImagePreview(null)} />
        </div>
    );
};

const DashboardModal = ({
    title,
    isOpen,
    onClose,
    children,
    maxWidth = "max-w-4xl",
}: {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: string;
}) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!shouldRender) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <button
                type="button"
                aria-label="Close modal"
                onClick={onClose}
                className={`fixed inset-0 bg-zinc-900/40 backdrop-blur-sm ${
                    isAnimatingOut ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
                }`}
            />
            <div
                className={`relative flex flex-col w-full ${maxWidth} max-h-[88vh] rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl md:p-6 text-zinc-900 dark:text-zinc-100 ${
                    isAnimatingOut ? "animate-modal-panel-out" : "animate-modal-panel-in"
                }`}
            >
                <div className="flex items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-4 shrink-0">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto pt-4 pb-6 pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

const NotificationCard = ({ notification, compact, onMarkRead }: { notification: NotificationItem; compact?: boolean; onMarkRead?: () => void }) => {
    const meta = notificationMeta(notification.type);

    return (
        <div className={`rounded-xl border p-4 transition ${notification.is_read ? "border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/60" : "border-lime-200/80 dark:border-lime-800/80 bg-lime-50/40 dark:bg-lime-950/20 shadow-xs"}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{notification.title || "System Notification"}</h3>
                        {!notification.is_read && <span className="h-2 w-2 rounded-full bg-lime-500" />}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{compact ? limitText(notification.message, 100) : notification.message}</p>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        {!compact && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>}
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{formatRelative(notification.created_at)}</p>
                    </div>
                </div>
                {!compact && !notification.is_read && onMarkRead && (
                    <button type="button" onClick={onMarkRead} className="text-xs font-semibold text-lime-700 dark:text-lime-400 hover:underline">
                        Mark as read
                    </button>
                )}
            </div>
        </div>
    );
};

const SummaryCard = ({
    title,
    icon,
    value,
    sub,
    badge,
    badgeClass,
    valueClass,
}: {
    title: string;
    icon: ReactNode;
    value: string;
    sub?: string;
    badge?: string;
    badgeClass: string;
    valueClass?: string;
}) => (
    <div className="rounded-2xl border border-white/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 p-5 backdrop-blur-xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] transition-colors">
        <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</h3>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">{icon}</span>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${valueClass ?? "text-zinc-900 dark:text-white"}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
        {badge && <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}>{badge}</p>}
    </div>
);

const QuickAction = ({ onClick, icon, title, sub }: { onClick: () => void; icon: ReactNode; title: string; sub: string }) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/70 p-3 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:border-zinc-200 dark:hover:border-zinc-600 cursor-pointer">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-700 shadow-2xs text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-600">{icon}</span>
        <span>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
        </span>
    </button>
);

const SectionHeading = ({ title }: { title: string }) => (
    <div className="border-t border-zinc-200/80 dark:border-zinc-700 pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">{title}</h3>
    </div>
);

const ReadOnlyInfo = ({ label, value }: { label: string; value?: string }) => (
    <div className="rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 p-3.5 shadow-2xs">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-400">{label}</p>
        <p className="text-sm font-bold text-zinc-900 dark:text-white">{value || "-"}</p>
    </div>
);

const Field = ({
    label,
    name,
    value,
    onChange,
    type = "text",
    required,
    placeholder,
    textarea,
    mono,
    maxLength,
    inputMode,
    pattern,
}: {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
    placeholder?: string;
    textarea?: boolean;
    mono?: boolean;
    maxLength?: number;
    inputMode?: "search" | "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "none";
    pattern?: string;
}) => (
    <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            {label}{required ? <span className="text-rose-500"> *</span> : ""}
        </span>
        {textarea ? (
            <textarea
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={3}
                required={required}
                placeholder={placeholder}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition focus:border-zinc-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-emerald-500 shadow-2xs"
            />
        ) : (
            <input
                type={type}
                name={name}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required={required}
                placeholder={placeholder}
                maxLength={maxLength}
                inputMode={inputMode}
                pattern={pattern}
                min={type === "number" ? 1 : undefined}
                max={type === "number" ? 150 : undefined}
                className={`w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition focus:border-zinc-900 dark:focus:border-emerald-500 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-emerald-500 shadow-2xs ${
                    mono ? "font-mono uppercase font-semibold" : ""
                }`}
            />
        )}
    </label>
);

const RequestCard = ({ request, onOpen }: { request: UpdateRequestItem; onOpen: () => void }) => {
    const changes = request.requested_changes;

    return (
        <button
            type="button"
            onClick={onOpen}
            className="w-full rounded-xl border border-zinc-200/80 bg-white p-4 text-left shadow-2xs transition hover:border-zinc-300 hover:shadow-xs"
        >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid flex-1 gap-3 text-sm md:grid-cols-4">
                    <Mini label={`Request #${request.update_request_id}`} value={changes.guest_name ?? "Guest"} strong />
                    <Mini label="Vehicle Plate" value={changes.guest_plate_number ?? "N/A"} mono />
                    <Mini label="Access Date" value={formatMaybeDate(changes.access_date)} />
                    <Mini label="Submitted" value={new Date(request.created_at).toLocaleDateString()} />
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(request.status)}`}>{request.status}</span>
            </div>
        </button>
    );
};

const RequestDetailModal = ({ isOpen, request, onClose }: { isOpen: boolean; request?: UpdateRequestItem; onClose: () => void }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);
    
    if (!shouldRender || !request) return null;

    const entries = Object.entries(request.requested_changes).filter(([key]) => key !== "request_type");

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <button type="button" aria-label="Close modal" onClick={onClose} className={`fixed inset-0 bg-zinc-900/40 backdrop-blur-sm ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
            <div className={`relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-zinc-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl text-zinc-900 ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}>
                <div className="flex items-start justify-between gap-4 border-b border-zinc-200/80 pb-4 shrink-0">
                    <div>
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-3 py-1 text-xs font-bold text-zinc-800">GUEST ACCESS</span>
                            <h3 className="text-xl font-bold text-zinc-900">Request #{request.update_request_id}</h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(request.status)}`}>{request.status}</span>
                        </div>
                        <p className="text-xs text-zinc-500">Submitted on {new Date(request.created_at).toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {entries.map(([key, value]) => (
                            <div key={key} className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3.5">
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">{labelize(key)}</p>
                                <p className="break-words text-sm font-semibold text-zinc-900">{String(value || "N/A")}</p>
                            </div>
                        ))}
                    </div>

                    {request.admin_notes && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <strong className="text-amber-900 font-semibold">Admin notes:</strong> {request.admin_notes}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const Head = ({ children, center }: { children: string; center?: boolean }) => (
    <th className={`px-6 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 ${center ? "text-center" : "text-left"}`}>{children}</th>
);

const StatMini = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className={`text-2xl font-bold tracking-tight ${danger ? "text-rose-600" : "text-zinc-900"}`}>{value}</p>
    </div>
);

const Mini = ({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) => (
    <div>
        <p className="text-xs text-zinc-400">{label}</p>
        <p className={`${strong ? "font-semibold" : ""} ${mono ? "font-mono font-bold" : ""} text-zinc-800`}>{value}</p>
    </div>
);

const EmptyCard = ({ text }: { text: string }) => (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/40 p-8 text-center text-sm text-zinc-400">{text}</div>
);

const notificationMeta = (type: string) => {
    const map: Record<string, { label: string; className: string }> = {
        gate_open: { label: "Gate Access", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
        unauthorized: { label: "Unauthorized", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
        update_request: { label: "Update Request", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
        system: { label: "System", className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
    };

    return map[type] ?? { label: "General", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
};

const statusClass = (status: UpdateRequestItem["status"]) => {
    if (status === "approved") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    if (status === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
};

const countToday = (logs: GateLog[], direction: GateLog["direction"]) => {
    const today = new Date().toDateString();
    return logs.filter((log) => log.direction === direction && new Date(log.logged_at).toDateString() === today).length;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatRelative = (value: string) => new Date(value).toLocaleString();
const formatMaybeDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "N/A";
const labelize = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
const limitText = (value: string, limit: number) => value.length > limit ? `${value.slice(0, limit)}...` : value;

const Svg = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <svg className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{children}</svg>
);

const ImagePreviewModal = ({ src, onClose }: { src: string | null; onClose: () => void }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(!!src);
    if (!shouldRender || !src) return null;

    return createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <button type="button" aria-label="Close modal" onClick={onClose} className={`fixed inset-0 bg-black/80 backdrop-blur-sm ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
            <div className={`relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl border border-white/10 shadow-2xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}>
                <img src={resolveCaptureUrl(src)} alt="Preview" className="max-h-[90vh] max-w-[90vw] object-contain" />
                <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition">
                    <Svg><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></Svg>
                </button>
            </div>
        </div>,
        document.body
    );
};

const BarIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 19V9m8 10V5m8 14v-7" /></Svg>;
const ExitIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H3m0 0 4-4m-4 4 4 4m5-9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2" /></Svg>;
const LockIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11V8a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" /></Svg>;
const ClipboardIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5h6m-8 4h10M7 13h10M7 17h6M9 3h6a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2Z" /></Svg>;
const CarIcon = ({ className }: { className?: string }) => <Svg className={className}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 17h14M7 17a2 2 0 1 1-4 0m18 0a2 2 0 1 1-4 0M5 17V9l2-4h10l2 4v8M7 9h10" /></Svg>;

export default ResidentHomePage;
