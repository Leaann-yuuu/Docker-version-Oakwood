import { useEffect, useState, useMemo, useRef, type FormEvent } from "react";
import { createPortal } from "react-dom";
import VisitorService from "../../services/VisitorService";
import type {
  GuardCreatePayload,
  ResidentOption,
  VisitorRequestItem,
  VisitorRequestStatus,
  VisitorSummary,
} from "../../interfaces/VisitorInterface";
import Spinner from "../../components/Spinner/Spinner";
import { formatPlateInput } from "../../utils/plateOcr";

type TabMode = "pending_resident" | "approved_guests" | "walkins_queue" | "all_records";

const getCurrentPhilippineTimeInput = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(now);
};

const formatTimeDisplay = (timeStr?: string | null): string => {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (/am|pm/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${String(hour).padStart(2, "0")}:${minute} ${ampm}`;
  }
  return trimmed;
};

const blankWalkinForm: GuardCreatePayload = {
  full_name: "",
  contact_number: "",
  resident_id: 0,
  visit_date: new Date().toISOString().split("T")[0],
  visit_time: getCurrentPhilippineTimeInput(),
  purpose: "",
  vehicle_plate: "",
  vehicle_type: "",
  notes: "",
  guard_remarks: "",
};

export default function VisitorManagementPage() {
  const [tab, setTab] = useState<TabMode>("pending_resident");
  const [residentFilter, setResidentFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "DENIED">("ALL");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requests, setRequests] = useState<VisitorRequestItem[]>([]);
  const requestsRef = useRef<VisitorRequestItem[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [summary, setSummary] = useState<VisitorSummary | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Modals & form state
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [walkinForm, setWalkinForm] = useState<GuardCreatePayload>(blankWalkinForm);
  const [submittingWalkin, setSubmittingWalkin] = useState(false);

  // Review modal state
  const [selectedRequest, setSelectedRequest] = useState<VisitorRequestItem | null>(null);
  const [guardRemarks, setGuardRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<VisitorRequestItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notification / Alert message
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Resident search in modal
  const [residentSearch, setResidentSearch] = useState("");

  // Keep requestsRef in sync with state
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  // Debounce search input to prevent rapid concurrent API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch resident directory for walk-in modal dropdown
  const loadResidents = async () => {
    try {
      const res = await VisitorService.loadResidents();
      setResidents(res.data?.residents || []);
    } catch (err) {
      console.error("Failed to load residents for modal", err);
    }
  };

  useEffect(() => {
    void loadResidents();
  }, []);

  const loadData = async (silent = false) => {
    // Only display blocking full-card spinner if initial load has no data yet
    if (!silent && requestsRef.current.length === 0) {
      setLoading(true);
    }
    setIsRefreshing(true);

    try {
      const [reqRes, sumRes] = await Promise.all([
        VisitorService.loadGuardRequests({
          search: debouncedSearch.trim() || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          date: selectedDate || undefined,
        }),
        VisitorService.getSummary(),
      ]);

      const items = reqRes.data?.requests?.data;
      if (Array.isArray(items)) {
        setRequests(items);
        requestsRef.current = items;
      }
      if (sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err) {
      console.error("Failed to load visitor data", err);
      if (!silent) {
        setNotice({ type: "error", text: "Failed to load visitor requests." });
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData(requestsRef.current.length > 0);
  }, [debouncedSearch, statusFilter, selectedDate]);

  useEffect(() => {
    // Auto-refresh periodically for real-time gate management without blocking table
    const interval = setInterval(() => {
      void loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [debouncedSearch, statusFilter, selectedDate]);

  // Tab filtering
  const residentRequests = useMemo(() => {
    return requests.filter((r) => r.requested_by === "resident");
  }, [requests]);

  const pendingResidentRequests = useMemo(() => {
    return residentRequests.filter((r) => r.status === "PENDING");
  }, [residentRequests]);

  const approvedResidentRequests = useMemo(() => {
    return residentRequests.filter((r) => r.status === "APPROVED");
  }, [residentRequests]);

  const deniedResidentRequests = useMemo(() => {
    return residentRequests.filter((r) => r.status === "DENIED");
  }, [residentRequests]);

  const approvedGuestRequests = useMemo(() => {
    return requests.filter((r) => r.status === "APPROVED" || r.status === "CONFIRMED");
  }, [requests]);

  const walkinQueueRequests = useMemo(() => {
    return requests.filter((r) => r.requested_by === "guard");
  }, [requests]);

  const displayRequests = useMemo(() => {
    if (tab === "pending_resident") {
      if (residentFilter === "PENDING") return pendingResidentRequests;
      if (residentFilter === "APPROVED") return approvedResidentRequests;
      if (residentFilter === "DENIED") return deniedResidentRequests;
      // Default (ALL): sort PENDING to top so guards see what needs review first
      return [...residentRequests].sort((a, b) => {
        if (a.status === "PENDING" && b.status !== "PENDING") return -1;
        if (a.status !== "PENDING" && b.status === "PENDING") return 1;
        return 0;
      });
    }
    if (tab === "approved_guests") return approvedGuestRequests;
    if (tab === "walkins_queue") return walkinQueueRequests;
    return requests;
  }, [
    tab,
    residentFilter,
    residentRequests,
    pendingResidentRequests,
    approvedResidentRequests,
    deniedResidentRequests,
    approvedGuestRequests,
    walkinQueueRequests,
    requests,
  ]);

  // Filtered residents list for dropdown modal
  const filteredResidents = useMemo(() => {
    if (!residentSearch.trim()) return residents;
    const q = residentSearch.toLowerCase();
    return residents.filter(
      (res) =>
        res.name.toLowerCase().includes(q) ||
        (res.address && res.address.toLowerCase().includes(q)) ||
        (res.plate_number && res.plate_number.toLowerCase().includes(q)) ||
        (res.contact_number && res.contact_number.includes(q))
    );
  }, [residents, residentSearch]);

  // Submit walk-in visitor form
  const handleWalkinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!walkinForm.resident_id) {
      setNotice({ type: "error", text: "Please select the resident to visit." });
      return;
    }

    if (!walkinForm.vehicle_plate || !walkinForm.vehicle_plate.trim()) {
      setNotice({ type: "error", text: "Vehicle plate number is required for visitor registration." });
      return;
    }

    if (!walkinForm.vehicle_type || !walkinForm.vehicle_type.trim()) {
      setNotice({ type: "error", text: "Specific vehicle type is required." });
      return;
    }

    setSubmittingWalkin(true);
    setNotice(null);
    try {
      const formattedTime = formatTimeDisplay(walkinForm.visit_time);
      const res = await VisitorService.guardCreate({
        ...walkinForm,
        visit_time: formattedTime || walkinForm.visit_time,
        vehicle_plate: walkinForm.vehicle_plate.trim().toUpperCase(),
        vehicle_type: walkinForm.vehicle_type.trim(),
      });

      setNotice({
        type: "success",
        text: res.data.message || "Walk-in visitor registered and notification sent to resident.",
      });
      setIsWalkinModalOpen(false);
      setWalkinForm({
        ...blankWalkinForm,
        visit_date: new Date().toISOString().split("T")[0],
        visit_time: getCurrentPhilippineTimeInput(),
      });
      setResidentSearch("");
      setTab("walkins_queue");
      await loadData();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Failed to register walk-in visitor.",
      });
    } finally {
      setSubmittingWalkin(false);
    }
  };

  const openRequestModal = (req: VisitorRequestItem) => {
    setModalError(null);
    setGuardRemarks(req.guard_remarks || "");
    setSelectedRequest(req);
  };

  const closeRequestModal = () => {
    setSelectedRequest(null);
    setModalError(null);
    setGuardRemarks("");
  };

  // Review resident request (Approve or Deny)
  const handleReview = async (decision: "APPROVED" | "DENIED") => {
    if (!selectedRequest) return;
    setActionLoading(true);
    setModalError(null);
    try {
      const res = await VisitorService.guardReview(selectedRequest.request_id, {
        decision,
        guard_remarks: guardRemarks.trim() || undefined,
      });

      setNotice({
        type: "success",
        text: res.data?.message || `Visitor request has been ${decision.toLowerCase()}.`,
      });
      closeRequestModal();
      await loadData(false);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to submit security guard decision.";
      setModalError(errorMsg);
      setNotice({
        type: "error",
        text: errorMsg,
      });
      void loadData(true);
    } finally {
      setActionLoading(false);
    }
  };

  // Mark visitor completed (Entry / Exit finished)
  const handleMarkStatus = async (requestId: number, status: "COMPLETED" | "CANCELLED") => {
    setActionLoading(true);
    setModalError(null);
    try {
      const res = await VisitorService.updateStatus(requestId, status);
      setNotice({
        type: "success",
        text: res.data?.message || `Status updated to ${status}.`,
      });
      closeRequestModal();
      await loadData(false);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to update visitor status.";
      setModalError(errorMsg);
      setNotice({
        type: "error",
        text: errorMsg,
      });
      void loadData(true);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete a visitor request record (available across all 4 tabs)
  const handleDeleteRequest = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setNotice(null);
    try {
      const res = await VisitorService.guardDelete(deleteTarget.request_id);
      setNotice({
        type: "success",
        text: res.data?.message || "Visitor record deleted successfully.",
      });
      if (selectedRequest?.request_id === deleteTarget.request_id) {
        closeRequestModal();
      }
      setDeleteTarget(null);
      await loadData(false);
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || err.message || "Failed to delete visitor record.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-6 text-zinc-900 dark:text-zinc-100">
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 border-b border-zinc-200/80 dark:border-white/10 pb-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs shrink-0">
              <svg className="h-6 w-6 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                Visitor Management System
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                Security Guard Gate Verification, Resident Authorizations &amp; Walk-In Access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                if (residents.length === 0) {
                  void loadResidents();
                }
                setIsWalkinModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-lime-600 hover:bg-lime-500 text-zinc-950 font-bold px-4 py-2.5 shadow-md shadow-lime-700/20 text-xs transition cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Register Walk-In Visitor</span>
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
              notice.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-3"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pending Guard Review</span>
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {summary?.pending_reviews ?? pendingResidentRequests.length}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Resident pre-registered requests awaiting decision</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Walk-in Awaiting Resident</span>
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
            {summary?.pending_confirmations ?? walkinQueueRequests.filter((r) => r.status === "PENDING").length}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Visitors at gate waiting for resident confirmation</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Today's Approved Visits</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {summary?.today_approved ?? 0}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Cleared for entry into subdivision</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Completed Visits</span>
            <span className="h-2 w-2 rounded-full bg-zinc-400" />
          </div>
          <div className="text-3xl font-black text-zinc-800 dark:text-zinc-200">
            {summary?.today_completed ?? 0}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Visitors logged out through gate</p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setTab("pending_resident")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              tab === "pending_resident"
                ? "bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>Review Resident Requests</span>
            {pendingResidentRequests.length > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-zinc-950 font-black animate-pulse">
                {pendingResidentRequests.length} pending
              </span>
            ) : residentRequests.length > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold">
                {residentRequests.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setTab("approved_guests")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              tab === "approved_guests"
                ? "bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Approved Guest Requests
            </span>
            {approvedGuestRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-black">
                {approvedGuestRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab("walkins_queue")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              tab === "walkins_queue"
                ? "bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>Walk-In Gate Queue</span>
            {walkinQueueRequests.filter((r) => r.status === "PENDING" || r.status === "CONFIRMED").length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500 text-white font-black">
                {walkinQueueRequests.filter((r) => r.status === "PENDING" || r.status === "CONFIRMED").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab("all_records")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              tab === "all_records"
                ? "bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>All Visitor Records</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sub-filters for Review Resident Requests */}
          {tab === "pending_resident" && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setResidentFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  residentFilter === "ALL"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span>All</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300">
                  {residentRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResidentFilter("PENDING")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  residentFilter === "PENDING"
                    ? "bg-amber-500 text-zinc-950 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span>Pending Review</span>
                {pendingResidentRequests.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-black animate-pulse">
                    {pendingResidentRequests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setResidentFilter("APPROVED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  residentFilter === "APPROVED"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span>Approved</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {approvedResidentRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResidentFilter("DENIED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  residentFilter === "DENIED"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span>Denied</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  {deniedResidentRequests.length}
                </span>
              </button>
            </div>
          )}

          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Search visitor, plate, resident..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-emerald-500"
            />
            <svg
              className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {tab === "all_records" && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="DENIED">DENIED</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 outline-none"
              />
            </>
          )}

          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void loadData(false)}
            title="Refresh records"
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-500" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main Table Content ── */}
      <div className="relative rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl shadow-xs overflow-hidden">
        {/* Subtle progress line when refreshing with existing data */}
        {isRefreshing && requests.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500/20 overflow-hidden z-20">
            <div className="h-full bg-emerald-500 animate-pulse w-full" />
          </div>
        )}

        {loading && requests.length === 0 ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Spinner size="lg" />
            <p className="text-xs text-zinc-400 font-medium animate-pulse">Loading visitor records...</p>
          </div>
        ) : displayRequests.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-semibold text-zinc-600 dark:text-zinc-300">No visitor requests found</p>
            <p className="text-xs text-zinc-400 mt-1">
              {tab === "pending_resident"
                ? residentRequests.length > 0
                  ? `No resident requests with status "${residentFilter}". You have ${residentRequests.length} resident requests on file.`
                  : "No resident-submitted visitor requests found."
                : tab === "approved_guests"
                ? "No approved guest requests currently recorded."
                : tab === "walkins_queue"
                ? "No active walk-in visitors currently registered at gate."
                : "Try adjusting your search or filters."}
            </p>
            {tab === "pending_resident" && residentFilter !== "ALL" && residentRequests.length > 0 && (
              <button
                type="button"
                onClick={() => setResidentFilter("ALL")}
                className="mt-3 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-700 text-white text-xs font-bold hover:bg-zinc-800 transition cursor-pointer"
              >
                View All Resident Requests ({residentRequests.length})
              </button>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto ${isRefreshing ? "opacity-80 transition-opacity duration-200" : "transition-opacity duration-200"}`}>
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3.5">Req # / Date</th>
                  <th className="px-5 py-3.5">Visitor Info</th>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-5 py-3.5">Host Resident</th>
                  <th className="px-5 py-3.5">Purpose / Notes</th>
                  <th className="px-5 py-3.5">Source</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                {displayRequests.map((req) => (
                  <tr
                    key={req.request_id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition cursor-pointer"
                    onClick={() => openRequestModal(req)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-mono font-bold text-zinc-900 dark:text-white">#{req.request_id}</p>
                      <p className="text-[11px] text-zinc-400">{req.visit_date} • {formatTimeDisplay(req.visit_time)}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-bold text-zinc-900 dark:text-white">{req.visitor?.full_name}</p>
                      <p className="text-[11px] text-zinc-500">{req.visitor?.contact_number}</p>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {req.visitor?.vehicle_plate ? (
                        <>
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100">
                            {req.visitor.vehicle_plate}
                          </span>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{req.visitor.vehicle_type || "Vehicle"}</p>
                        </>
                      ) : (
                        <span className="text-zinc-400 italic">Pedestrian / Walk-in</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-bold text-zinc-900 dark:text-white">
                        {req.resident ? `${req.resident.first_name} ${req.resident.last_name}` : "N/A"}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                        {req.resident?.address || req.resident?.contact_number || ""}
                      </p>
                    </td>

                    <td className="px-5 py-3.5 max-w-[200px]">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{req.purpose}</p>
                      {req.notes && (
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">Note: {req.notes}</p>
                      )}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.requested_by === "resident"
                            ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {req.requested_by === "resident" ? "Resident Pre-Reg" : "Guard Walk-In"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusBadge status={req.status} />
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Action for Resident Request Review */}
                        {req.requested_by === "resident" && req.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => {
                              openRequestModal(req);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                          >
                            Review
                          </button>
                        )}

                        {req.requested_by === "resident" && (req.status === "APPROVED" || req.status === "DENIED") && (
                          <button
                            type="button"
                            onClick={() => {
                              openRequestModal(req);
                            }}
                            className="px-2 py-1 rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-bold text-[11px] transition cursor-pointer"
                          >
                            Update Decision
                          </button>
                        )}

                        {/* Quick Action for Confirmed Walk-In */}
                        {req.requested_by === "guard" && req.status === "CONFIRMED" && (
                          <button
                            type="button"
                            onClick={() => void handleMarkStatus(req.request_id, "COMPLETED")}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                          >
                            Allow Entry
                          </button>
                        )}

                        {/* Complete button for approved active visitor */}
                        {req.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => void handleMarkStatus(req.request_id, "COMPLETED")}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 text-white font-bold text-[11px] transition cursor-pointer"
                          >
                            Mark Completed
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openRequestModal(req)}
                          className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium transition cursor-pointer"
                        >
                          Details
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(req)}
                          title="Delete visitor record"
                          className="px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-bold transition cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Register Walk-In Visitor (Guard Flow 2) ── */}
      {isWalkinModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/70 backdrop-blur-sm animate-modal-backdrop-in"
            onClick={() => setIsWalkinModalOpen(false)}
          >
            <div
              className="relative w-full max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-6 sm:px-8 py-5 sm:py-6 shadow-2xl text-zinc-900 dark:text-zinc-100 my-auto animate-modal-panel-in"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-lime-600 dark:text-lime-400">
                  Gate Registration &bull; Flow 2
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                  Register Walk-In Visitor at Gate
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkinModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-lg font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWalkinSubmit} className="space-y-3.5 sm:space-y-4">
              {/* Resident selector */}
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Select Resident Being Visited <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Filter resident by name, address, or vehicle..."
                  value={residentSearch}
                  onChange={(e) => setResidentSearch(e.target.value)}
                  className="w-full mb-1.5 px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500"
                />
                <select
                  required
                  value={walkinForm.resident_id}
                  onChange={(e) => setWalkinForm({ ...walkinForm, resident_id: Number(e.target.value) })}
                  className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500"
                >
                  <option value={0}>-- Choose Resident --</option>
                  {filteredResidents.map((r) => (
                    <option key={r.user_id} value={r.user_id}>
                      {r.name} {r.address ? `• ${r.address}` : ""} {r.contact_number ? `(${r.contact_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visitor details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Visitor Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan De La Cruz"
                    value={walkinForm.full_name}
                    onChange={(e) => setWalkinForm({ ...walkinForm, full_name: e.target.value })}
                    className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="09171234567"
                    value={walkinForm.contact_number}
                    onChange={(e) =>
                      setWalkinForm({ ...walkinForm, contact_number: e.target.value.replace(/\D/g, "").slice(0, 11) })
                    }
                    className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500"
                  />
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Date of Visit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={walkinForm.visit_date}
                    onChange={(e) => setWalkinForm({ ...walkinForm, visit_date: e.target.value })}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Time of Arrival <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={walkinForm.visit_time}
                    onChange={(e) => setWalkinForm({ ...walkinForm, visit_time: e.target.value })}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {}
                    }}
                    className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Purpose of Visit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Personal Visit, Package Delivery, Maintenance, etc."
                  value={walkinForm.purpose}
                  onChange={(e) => setWalkinForm({ ...walkinForm, purpose: e.target.value })}
                  className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Vehicle information (Required with specific vehicle type) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Vehicle Plate Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ABC1234 / 123ABC"
                    value={walkinForm.vehicle_plate}
                    onChange={(e) =>
                      setWalkinForm({ ...walkinForm, vehicle_plate: formatPlateInput(e.target.value) })
                    }
                    className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-mono uppercase font-bold tracking-wider text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500"
                  />
                  <p className="text-xs text-zinc-400 mt-1">Vehicle plate is required for security clearance</p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                    Specific Vehicle Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={walkinForm.vehicle_type}
                    onChange={(e) => setWalkinForm({ ...walkinForm, vehicle_type: e.target.value })}
                    className={`w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-lime-500 ${
                      !walkinForm.vehicle_type ? "text-zinc-400 dark:text-zinc-400" : "text-zinc-900 dark:text-white font-medium"
                    }`}
                  >
                    <option value="">-- Select Specific Vehicle Type --</option>
                    <option value="Sedan">Sedan (4-door passenger car)</option>
                    <option value="SUV">SUV (Sport Utility Vehicle)</option>
                    <option value="Van / MPV">Van / MPV (Multi-Purpose Vehicle)</option>
                    <option value="Pickup Truck">Pickup Truck</option>
                    <option value="Hatchback / Compact">Hatchback / Compact Car</option>
                    <option value="Motorcycle / Scooter">Motorcycle / Scooter</option>
                    <option value="Delivery Van / Courier">Delivery Van / Courier (Shopee, Lazada, etc.)</option>
                    <option value="Delivery Truck / Lorry">Delivery Truck / Forwarder / Lorry</option>
                    <option value="Taxi / Grab / TNVS">Taxi / Grab / Ride-Hailing TNVS</option>
                    <option value="Service / Maintenance Truck">Service / Contractor / Maintenance Vehicle</option>
                    <option value="Bicycle / E-Bike">Bicycle / E-Bike</option>
                    <option value="Other">Other Specific Vehicle</option>
                  </select>
                  <p className="text-xs text-zinc-400 mt-1">Select the specific type of visitor vehicle</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Gate Officer Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="ID surrendered, accompanied passengers, etc."
                  value={walkinForm.notes}
                  onChange={(e) => setWalkinForm({ ...walkinForm, notes: e.target.value })}
                  className="w-full px-4 py-2 sm:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setIsWalkinModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWalkin}
                  className="px-6 py-2.5 rounded-xl bg-lime-600 hover:bg-lime-500 text-zinc-950 text-sm font-black shadow-md shadow-lime-700/20 transition disabled:opacity-60"
                >
                  {submittingWalkin ? "Sending Alert..." : "Send Request to Resident"}
                </button>
              </div>
            </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── Modal: Request Details & Guard Action (Approve / Deny) ── */}
      {selectedRequest &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto bg-black/75 backdrop-blur-sm animate-modal-backdrop-in"
            onClick={closeRequestModal}
          >
            <div
              className="relative w-full max-w-2xl lg:max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-2xl text-zinc-900 dark:text-zinc-100 my-auto animate-modal-panel-in"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-5">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Request #{selectedRequest.request_id} &bull; {selectedRequest.requested_by.toUpperCase()}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white mt-1">
                  Visitor Access Details
                </h3>
              </div>
              <button
                type="button"
                onClick={closeRequestModal}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xl font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700">
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</p>
                  <div className="mt-1.5">
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Registered Date</p>
                  <p className="font-bold text-sm sm:text-base text-zinc-800 dark:text-zinc-200 mt-1.5">
                    {new Date(selectedRequest.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Visitor Details */}
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700 p-4 sm:p-5 space-y-3">
                <h4 className="font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-xs sm:text-sm">
                  Visitor Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Full Name:</span>{" "}
                    <span className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white block sm:inline">
                      {selectedRequest.visitor?.full_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Contact:</span>{" "}
                    <span className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-200 block sm:inline">
                      {selectedRequest.visitor?.contact_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Vehicle Plate:</span>{" "}
                    <span className="font-mono font-black text-sm sm:text-base text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-300 dark:border-zinc-700 inline-block">
                      {selectedRequest.visitor?.vehicle_plate || "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Vehicle Type:</span>{" "}
                    <span className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-200 block sm:inline">
                      {selectedRequest.visitor?.vehicle_type || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Host Resident */}
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700 p-4 sm:p-5 space-y-3">
                <h4 className="font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-xs sm:text-sm">
                  Host Resident Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Resident Name:</span>{" "}
                    <span className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white block sm:inline">
                      {selectedRequest.resident ? `${selectedRequest.resident.first_name} ${selectedRequest.resident.last_name}` : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Address:</span>{" "}
                    <span className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-200 block sm:inline">
                      {selectedRequest.resident?.address || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Phone:</span>{" "}
                    <span className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-200 block sm:inline">
                      {selectedRequest.resident?.contact_number || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs sm:text-sm font-medium">Visit Schedule:</span>{" "}
                    <span className="font-semibold text-sm sm:text-base text-zinc-800 dark:text-zinc-200 block sm:inline">
                      {selectedRequest.visit_date} @ {formatTimeDisplay(selectedRequest.visit_time)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Purpose & Notes */}
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700 p-4 sm:p-5 space-y-2.5">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Purpose of Visit</p>
                <p className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">{selectedRequest.purpose}</p>
                {selectedRequest.notes && (
                  <>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-3">Notes</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{selectedRequest.notes}</p>
                  </>
                )}
                {selectedRequest.guard_remarks && (
                  <>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-3">Guard Remarks</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{selectedRequest.guard_remarks}</p>
                  </>
                )}
              </div>

              {/* Decision Section for Resident Requests Pending Guard Review */}
              {selectedRequest.requested_by === "resident" && (selectedRequest.status === "PENDING" || selectedRequest.status === "APPROVED" || selectedRequest.status === "DENIED") && (
                <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-amber-900 dark:text-amber-300 text-sm">
                      Security Guard Verification Decision
                    </p>
                    {selectedRequest.status !== "PENDING" && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                        Current: {selectedRequest.status}
                      </span>
                    )}
                  </div>

                  {modalError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{modalError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalError(null)}
                        className="text-xs font-bold hover:underline ml-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <textarea
                    rows={3}
                    placeholder="Enter security guard remarks (optional)..."
                    value={guardRemarks}
                    onChange={(e) => setGuardRemarks(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleReview("DENIED")}
                      className="py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 shadow-xs"
                    >
                      {actionLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        "Deny Request"
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleReview("APPROVED")}
                      className="py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 shadow-xs"
                    >
                      {actionLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        "Approve Request"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Status Update Actions for Walk-Ins or Approved Visitors */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setDeleteTarget(selectedRequest)}
                  className="py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-sm font-bold transition cursor-pointer disabled:opacity-60"
                >
                  Delete Record
                </button>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {selectedRequest.status === "CONFIRMED" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleMarkStatus(selectedRequest.request_id, "COMPLETED")}
                      className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs transition cursor-pointer"
                    >
                      Confirm Entry &amp; Mark Completed
                    </button>
                  )}

                  {selectedRequest.status === "APPROVED" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleMarkStatus(selectedRequest.request_id, "COMPLETED")}
                      className="py-2.5 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold text-sm transition cursor-pointer shadow-xs"
                    >
                      Mark Visit Completed
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={closeRequestModal}
                    className="py-2.5 px-6 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
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

      {/* ── Modal: Confirm Delete Visitor Record ── */}
      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-modal-backdrop-in"
            onClick={() => !deleteLoading && setDeleteTarget(null)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 animate-modal-panel-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                    Delete Visitor Record?
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Are you sure you want to permanently delete request{" "}
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                      #{deleteTarget.request_id}
                    </span>{" "}
                    for{" "}
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {deleteTarget.visitor?.full_name || "this visitor"}
                    </span>
                    ? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => void handleDeleteRequest()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60 flex items-center gap-2 shadow-xs"
                >
                  {deleteLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function StatusBadge({ status }: { status: VisitorRequestStatus }) {
  const styles: Record<VisitorRequestStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    DENIED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    COMPLETED: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    CANCELLED: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
        styles[status] || styles.PENDING
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
