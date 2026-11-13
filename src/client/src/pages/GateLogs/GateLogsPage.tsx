import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import GateAccessService from "../../services/GateAccessService";
import type { GateLog } from "../../interfaces/GateInterface";
import Pagination from "../../components/UI/Pagination";

const GateLogsSkeleton = () => (
    <div className="animate-pulse space-y-4">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                        <Head>Timestamp</Head>
                        <Head>Plate Number</Head>
                        <Head>Owner Name</Head>
                        <Head>Car Info</Head>
                        <Head>Direction</Head>
                        <Head>Status</Head>
                        <Head>Image</Head>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <tr key={i}>
                            <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-6 w-16 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-10 w-16 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export const resolveCaptureUrl = (url?: string | null): string => {
    if (!url) return "";
    const cleanUrl = url.trim();
    if (cleanUrl.includes("/api/gate/captures/")) {
        if (cleanUrl.startsWith("http://localhost/") && !cleanUrl.startsWith("http://localhost:")) {
            return cleanUrl.replace("http://localhost/", "http://127.0.0.1:8080/");
        }
        return cleanUrl;
    }
    const filename = cleanUrl.split("/").pop();
    if (!filename) return "";
    return `http://127.0.0.1:8080/api/gate/captures/${filename}`;
};

const GateLogsPage = () => {
    const [logs, setLogs] = useState<GateLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState("");
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");

    // Pagination state
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [from, setFrom] = useState<number | null>(null);
    const [to, setTo] = useState<number | null>(null);

    // Image preview modal
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const handle = window.setTimeout(() => {
            GateAccessService.loadGateLogs(page, { direction, status, search })
                .then((res) => {
                    const paginated = res.data.logs;
                    setLogs(paginated.data ?? []);
                    setPage(paginated.current_page ?? page);
                    setLastPage(paginated.last_page ?? 1);
                    setTotal(paginated.total ?? 0);
                    setFrom(paginated.from ?? null);
                    setTo(paginated.to ?? null);
                })
                .catch((err) => {
                    console.error("Failed to fetch gate logs:", err);
                    setLogs([]);
                })
                .finally(() => setLoading(false));
        }, 200);

        return () => window.clearTimeout(handle);
    }, [page, direction, status, search]);

    const handleSearchChange = (val: string) => {
        setSearch(val);
        setPage(1);
    };

    const handleDirectionChange = (val: string) => {
        setDirection(val);
        setPage(1);
    };

    const handleStatusChange = (val: string) => {
        setStatus(val);
        setPage(1);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Gate Logs</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">View all gate entry and exit events</p>
            </div>

            <div className="flex flex-wrap gap-4">
                <input
                    value={search}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="Search by plate number or owner name..."
                    className="min-w-[220px] flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <select
                    value={direction}
                    onChange={(event) => handleDirectionChange(event.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                    <option value="">All Directions</option>
                    <option value="IN">Entry</option>
                    <option value="OUT">Exit</option>
                </select>
                <select
                    value={status}
                    onChange={(event) => handleStatusChange(event.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                    <option value="">All Status</option>
                    <option value="authorized">Authorized</option>
                    <option value="unauthorized">Unauthorized</option>
                </select>
            </div>

            {loading ? (
                <GateLogsSkeleton />
            ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                            <thead className="bg-zinc-50 dark:bg-zinc-900">
                                <tr>
                                    <Head>Timestamp</Head>
                                    <Head>Plate Number</Head>
                                    <Head>Owner Name</Head>
                                    <Head>Car Info</Head>
                                    <Head>Direction</Head>
                                    <Head>Status</Head>
                                    <Head>Image</Head>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                                {logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr key={log.gate_log_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{new Date(log.logged_at).toLocaleString()}</td>
                                            <td className="whitespace-nowrap px-6 py-4 font-mono font-semibold text-zinc-900 dark:text-zinc-100">{log.plate_number}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{log.owner_name ?? "N/A"}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{log.car_model || log.car_color ? `${log.car_model ?? "N/A"} - ${log.car_color ?? "N/A"}` : "N/A"}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{log.direction === "IN" ? "Entry" : "Exit"}</td>
                                            <td className="whitespace-nowrap px-6 py-4"><StatusBadge status={log.status} /></td>
                                            <td className="px-6 py-4">
                                                {log.capture_image ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewImage(log.capture_image ?? null)}
                                                        className="group relative cursor-pointer"
                                                        title="Click to view full image"
                                                    >
                                                        <img
                                                            src={resolveCaptureUrl(log.capture_image)}
                                                            alt="Gate capture"
                                                            className="h-10 w-16 rounded object-cover border border-zinc-200 dark:border-zinc-700 transition group-hover:opacity-80"
                                                        />
                                                    </button>
                                                ) : (
                                                    <span className="text-zinc-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">No logs found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar */}
                    <Pagination
                        currentPage={page}
                        lastPage={lastPage}
                        total={total}
                        from={from}
                        to={to}
                        onPageChange={(newPage) => setPage(newPage)}
                        loading={loading}
                        itemName="logs"
                        maxVisiblePages={10}
                    />
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Gate Capture Image</h3>
                            <button
                                type="button"
                                onClick={() => setPreviewImage(null)}
                                className="rounded-full bg-zinc-800 p-1.5 text-zinc-400 hover:text-white transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                        <img src={resolveCaptureUrl(previewImage)} alt="Captured plate" className="max-h-[75vh] w-full rounded-lg object-contain" />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const Head = ({ children }: { children: string }) => (
    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{children}</th>
);

const StatusBadge = ({ status }: { status: GateLog["status"] }) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${status === "authorized" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"}`}>
        {status}
    </span>
);

export default GateLogsPage;
