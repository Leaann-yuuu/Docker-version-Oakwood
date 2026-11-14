import { useEffect, useState, useMemo, type FormEvent } from "react";
import { createPortal } from "react-dom";
import VisitorService from "../../services/VisitorService";
import type {
  ResidentCreatePayload,
  VisitorRequestItem,
  VisitorRequestStatus,
} from "../../interfaces/VisitorInterface";
import Spinner from "../../components/Spinner/Spinner";
import { formatPlateInput } from "../../utils/plateOcr";

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

const blankResidentForm: ResidentCreatePayload = {
  full_name: "",
  contact_number: "",
  visit_date: new Date().toISOString().split("T")[0],
  visit_time: getCurrentPhilippineTimeInput(),
  purpose: "",
  vehicle_plate: "",
  vehicle_type: "",
  notes: "",
};

export default function ResidentVisitorsPage() {
  const [requests, setRequests] = useState<VisitorRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Pre-register visitor modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ResidentCreatePayload>(blankResidentForm);
  const [submitting, setSubmitting] = useState(false);

  // Selected request modal / detail view
  const [selectedRequest, setSelectedRequest] = useState<VisitorRequestItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [residentRejectNote, setResidentRejectNote] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await VisitorService.loadResidentRequests(1, statusFilter);
      setRequests(res.data.requests.data || []);
    } catch (err) {
      console.error("Failed to load resident visitor requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
    // Poll every 10s for incoming walk-in alerts from security guards
    const interval = setInterval(() => {
      void loadRequests();
    }, 10000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  // Urgent pending walk-ins registered by guard awaiting resident confirmation
  const incomingWalkins = useMemo(() => {
    return requests.filter(
      (r) => r.requested_by === "guard" && r.status === "PENDING"
    );
  }, [requests]);

  // Handle resident pre-registration submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.vehicle_plate.trim()) {
      setNotice({ type: "error", text: "Please enter the visitor's vehicle plate number." });
      return;
    }
    if (!form.vehicle_type) {
      setNotice({ type: "error", text: "Please select a vehicle type." });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const formattedTime = formatTimeDisplay(form.visit_time);
      const res = await VisitorService.residentCreate({
        ...form,
        visit_time: formattedTime || form.visit_time,
        vehicle_plate: form.vehicle_plate.trim().toUpperCase(),
        vehicle_type: form.vehicle_type.trim(),
      });

      setNotice({
        type: "success",
        text: res.data.message || "Visitor request submitted to security guards for review.",
      });
      setIsModalOpen(false);
      setForm(blankResidentForm);
      await loadRequests();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Failed to submit visitor request.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle resident respond to guard walk-in (Confirm or Reject)
  const handleWalkinResponse = async (requestId: number, response: "CONFIRM" | "REJECT") => {
    setActionLoading(true);
    try {
      const res = await VisitorService.residentRespond(requestId, {
        response,
        notes: response === "REJECT" && residentRejectNote ? residentRejectNote : undefined,
      });

      setNotice({
        type: "success",
        text: res.data.message || `Visitor visit ${response === "CONFIRM" ? "confirmed" : "rejected"}.`,
      });
      setSelectedRequest(null);
      setResidentRejectNote("");
      await loadRequests();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Failed to respond to visitor request.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel own request
  const handleCancelRequest = async (requestId: number) => {
    if (!window.confirm("Are you sure you want to cancel this visitor request?")) return;
    setActionLoading(true);
    try {
      const res = await VisitorService.residentCancel(requestId);
      setNotice({
        type: "success",
        text: res.data.message || "Visitor request cancelled.",
      });
      setSelectedRequest(null);
      await loadRequests();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Failed to cancel request.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-6 text-zinc-900 dark:text-zinc-100">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200/80 dark:border-white/10 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs shrink-0">
            <svg className="h-6 w-6 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Visitor Passes &amp; Gate Access
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Pre-register visitors and verify guests arriving at Oakwood Gate
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-emerald-600 hover:bg-zinc-800 dark:hover:bg-emerald-500 text-white font-bold px-4 py-2.5 shadow-sm text-xs transition cursor-pointer"
          >
            <svg className="w-4 h-4 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Pre-Register Expected Visitor</span>
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
            className="text-zinc-400 hover:text-zinc-700 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── PRIORITY: Incoming Walk-In Visitor Alerts (Flow 2) ── */}
      {incomingWalkins.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
            <h2 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Urgent: Gate Visitor Confirmation Required ({incomingWalkins.length})
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {incomingWalkins.map((walkin) => (
              <div
                key={walkin.request_id}
                className="rounded-2xl border-2 border-rose-400/80 bg-rose-50/50 dark:bg-rose-950/30 p-5 shadow-lg backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 font-bold text-[10px] uppercase tracking-wider">
                      Visitor at Gate
                    </span>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white mt-1">
                      {walkin.visitor?.full_name}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      Phone: <span className="font-semibold">{walkin.visitor?.contact_number}</span>
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-zinc-500">
                    Arrival: {formatTimeDisplay(walkin.visit_time)}
                  </span>
                </div>

                <div className="rounded-xl bg-white dark:bg-zinc-900/90 border border-rose-200 dark:border-rose-900/40 p-3 space-y-1 mb-4 text-xs">
                  <p>
                    <span className="text-zinc-400 font-medium">Purpose:</span>{" "}
                    <span className="font-bold text-zinc-900 dark:text-white">{walkin.purpose}</span>
                  </p>
                  {walkin.visitor?.vehicle_plate && (
                    <p>
                      <span className="text-zinc-400 font-medium">Vehicle Plate:</span>{" "}
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">
                        {walkin.visitor.vehicle_plate} ({walkin.visitor.vehicle_type || "Vehicle"})
                      </span>
                    </p>
                  )}
                  {walkin.guard_remarks && (
                    <p className="text-zinc-500 italic">Guard Remarks: {walkin.guard_remarks}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void handleWalkinResponse(walkin.request_id, "REJECT")}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-xs transition cursor-pointer disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void handleWalkinResponse(walkin.request_id, "CONFIRM")}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-700/20 transition cursor-pointer disabled:opacity-60"
                  >
                    Confirm Visitor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Status Filter & Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {["ALL", "PENDING", "APPROVED", "CONFIRMED", "DENIED", "COMPLETED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? "bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {st === "ALL" ? "All Passes" : st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void loadRequests()}
          className="self-end sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Passes List ── */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Spinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-semibold text-zinc-600 dark:text-zinc-300">No visitor requests found</p>
            <p className="text-xs text-zinc-400 mt-1">Pre-register your upcoming guests using the button above.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {requests.map((item) => (
              <div
                key={item.request_id}
                onClick={() => setSelectedRequest(item)}
                className="p-5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-400">#{item.request_id}</span>
                    <h3 className="text-base font-black text-zinc-900 dark:text-white">
                      {item.visitor?.full_name}
                    </h3>
                    <ResidentStatusBadge status={item.status} />
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.requested_by === "resident"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      }`}
                    >
                      {item.requested_by === "resident" ? "Pre-Registered by You" : "Walk-in Registered by Guard"}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-1">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Purpose:</span> {item.purpose}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-1">
                    <span>
                      📅 <strong className="text-zinc-600 dark:text-zinc-300">{item.visit_date}</strong> at{" "}
                      <strong className="text-zinc-600 dark:text-zinc-300">{formatTimeDisplay(item.visit_time)}</strong>
                    </span>
                    {item.visitor?.vehicle_plate && (
                      <span>
                        🚗 <strong className="font-mono text-zinc-700 dark:text-zinc-200">{item.visitor.vehicle_plate}</strong>
                        {item.visitor.vehicle_type ? ` (${item.visitor.vehicle_type})` : ""}
                      </span>
                    )}
                    <span>📞 {item.visitor?.contact_number}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                  {item.requested_by === "guard" && item.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleWalkinResponse(item.request_id, "REJECT")}
                        className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleWalkinResponse(item.request_id, "CONFIRM")}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition"
                      >
                        Confirm
                      </button>
                    </div>
                  )}

                  {item.status === "PENDING" && item.requested_by === "resident" && (
                    <button
                      type="button"
                      onClick={() => void handleCancelRequest(item.request_id)}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-xs font-semibold text-zinc-500 transition"
                    >
                      Cancel Request
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedRequest(item)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition"
                  >
                    View Pass
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Pre-Register Expected Visitor (Flow 1) ── */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/70 backdrop-blur-sm animate-modal-backdrop-in"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 my-auto animate-modal-panel-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Visitor Registration &bull; Flow 1
                  </span>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                    Pre-Register Expected Visitor
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-base font-bold cursor-pointer"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Visitor Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Full name of visitor"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Contact Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="09171234567"
                      value={form.contact_number}
                      onChange={(e) =>
                        setForm({ ...form, contact_number: e.target.value.replace(/\D/g, "").slice(0, 11) })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Date of Visit <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={form.visit_date}
                      onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Expected Time of Visit <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={form.visit_time}
                      onChange={(e) => setForm({ ...form, visit_time: e.target.value })}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Purpose of Visit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Family gathering, Home repair, Delivery, etc."
                    value={form.purpose}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Vehicle Plate Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ABC1234"
                      value={form.vehicle_plate}
                      onChange={(e) => setForm({ ...form, vehicle_plate: formatPlateInput(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono uppercase font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Vehicle Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={form.vehicle_type}
                      onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="" disabled>Select vehicle type</option>
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="Van">Van</option>
                      <option value="Pickup">Pickup Truck</option>
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Additional Notes for Security Guard (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Special instructions or expected entry details"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-emerald-600 hover:bg-zinc-800 dark:hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition disabled:opacity-60 cursor-pointer"
                  >
                    {submitting ? "Submitting..." : "Send Request to Security Guard"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── Modal: Visitor Pass Detail View ── */}
      {selectedRequest &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/70 backdrop-blur-sm animate-modal-backdrop-in"
            onClick={() => setSelectedRequest(null)}
          >
            <div
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 my-auto animate-modal-panel-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Digital Pass &bull; #{selectedRequest.request_id}
                  </span>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                    {selectedRequest.visitor?.full_name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-base font-bold cursor-pointer"
                  aria-label="Close pass view"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700">
                  <span className="font-bold text-zinc-500">Current Status</span>
                  <ResidentStatusBadge status={selectedRequest.status} />
                </div>

                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2">
                  <h4 className="font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">
                    Pass Information
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-zinc-400">Date of Visit:</span>{" "}
                      <span className="font-bold">{selectedRequest.visit_date}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Time:</span>{" "}
                      <span className="font-bold">{formatTimeDisplay(selectedRequest.visit_time)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Visitor Contact:</span>{" "}
                      <span className="font-semibold">{selectedRequest.visitor?.contact_number}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Plate Number:</span>{" "}
                      <span className="font-mono font-bold">{selectedRequest.visitor?.vehicle_plate || "None"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Purpose of Visit</p>
                  <p className="font-semibold text-zinc-900 dark:text-white">{selectedRequest.purpose}</p>
                  {selectedRequest.notes && (
                    <p className="text-zinc-500 pt-1">Notes: {selectedRequest.notes}</p>
                  )}
                  {selectedRequest.guard_remarks && (
                    <p className="text-zinc-500 pt-1">Security Officer Remarks: {selectedRequest.guard_remarks}</p>
                  )}
                </div>

                {/* If walkin is pending confirmation */}
                {selectedRequest.requested_by === "guard" && selectedRequest.status === "PENDING" && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-3">
                    <p className="font-black text-rose-800 dark:text-rose-300">
                      Visitor is at the gate. Confirm or reject access:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void handleWalkinResponse(selectedRequest.request_id, "REJECT")}
                        className="py-2.5 px-4 rounded-xl border border-rose-400 bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 font-bold text-xs cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void handleWalkinResponse(selectedRequest.request_id, "CONFIRM")}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs cursor-pointer transition"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    className="py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function ResidentStatusBadge({ status }: { status: VisitorRequestStatus }) {
  const styles: Record<VisitorRequestStatus, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    DENIED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
    CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
    COMPLETED: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
    CANCELLED: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
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
