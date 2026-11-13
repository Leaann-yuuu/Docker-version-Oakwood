import { useEffect, useState } from "react";
import GateAccessService from "../../services/GateAccessService";
import type { GateLog } from "../../interfaces/GateInterface";
import type { ActivityLog } from "../../interfaces/ActivityLogInterface";
import Pagination from "../../components/UI/Pagination";

const ActivityLogsSkeleton = () => (
    <div className="animate-pulse space-y-4">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                        <th className="px-6 py-4"><div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" /></th>
                        <th className="px-6 py-4"><div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" /></th>
                        <th className="px-6 py-4"><div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" /></th>
                        <th className="px-6 py-4"><div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" /></th>
                        <th className="px-6 py-4"><div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700" /></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <tr key={i}>
                            <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-6 w-16 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const ActivityLogsPage = () => {
    const [activeTab, setActiveTab] = useState<"gate" | "system">("gate");

    // Gate activity state
    const [gateLogs, setGateLogs] = useState<GateLog[]>([]);
    const [gateLoading, setGateLoading] = useState(true);
    const [gatePage, setGatePage] = useState(1);
    const [gateLastPage, setGateLastPage] = useState(1);
    const [gateTotal, setGateTotal] = useState(0);
    const [gateFrom, setGateFrom] = useState<number | null>(null);
    const [gateTo, setGateTo] = useState<number | null>(null);
    const [gateSearch, setGateSearch] = useState("");

    // System activity state
    const [systemLogs, setSystemLogs] = useState<ActivityLog[]>([]);
    const [systemLoading, setSystemLoading] = useState(false);
    const [systemPage, setSystemPage] = useState(1);
    const [systemLastPage, setSystemLastPage] = useState(1);
    const [systemTotal, setSystemTotal] = useState(0);
    const [systemFrom, setSystemFrom] = useState<number | null>(null);
    const [systemTo, setSystemTo] = useState<number | null>(null);
    const [systemSearch, setSystemSearch] = useState("");

    // Fetch gate activity
    useEffect(() => {
        if (activeTab !== "gate") return;
        setGateLoading(true);
        const handle = window.setTimeout(() => {
            GateAccessService.loadGateLogs(gatePage, { search: gateSearch })
                .then((res) => {
                    const paginated = res.data.logs;
                    setGateLogs(paginated.data ?? []);
                    setGatePage(paginated.current_page ?? gatePage);
                    setGateLastPage(paginated.last_page ?? 1);
                    setGateTotal(paginated.total ?? 0);
                    setGateFrom(paginated.from ?? null);
                    setGateTo(paginated.to ?? null);
                })
                .catch((err) => {
                    console.error("Failed to load gate logs:", err);
                    setGateLogs([]);
                })
                .finally(() => setGateLoading(false));
        }, 200);

        return () => window.clearTimeout(handle);
    }, [activeTab, gatePage, gateSearch]);

    // Fetch system activity
    useEffect(() => {
        if (activeTab !== "system") return;
        setSystemLoading(true);
        const handle = window.setTimeout(() => {
            GateAccessService.loadActivityLogs(systemPage, { search: systemSearch })
                .then((res) => {
                    const paginated = res.data.logs;
                    setSystemLogs(paginated.data ?? []);
                    setSystemPage(paginated.current_page ?? systemPage);
                    setSystemLastPage(paginated.last_page ?? 1);
                    setSystemTotal(paginated.total ?? 0);
                    setSystemFrom(paginated.from ?? null);
                    setSystemTo(paginated.to ?? null);
                })
                .catch((err) => {
                    console.error("Failed to load system activity logs:", err);
                    setSystemLogs([]);
                })
                .finally(() => setSystemLoading(false));
        }, 200);

        return () => window.clearTimeout(handle);
    }, [activeTab, systemPage, systemSearch]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Activity Logs</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {activeTab === "gate"
                            ? "Overview of latest vehicle gate movement events"
                            : "Overview of authentication and system events"}
                    </p>
                </div>

                {/* Tab selector */}
                <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800">
                    <button
                        type="button"
                        onClick={() => setActiveTab("gate")}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            activeTab === "gate"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        }`}
                    >
                        Gate Activity
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("system")}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            activeTab === "system"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                        }`}
                    >
                        System / Guard Activity
                    </button>
                </div>
            </div>

            {/* Filter Search */}
            <div className="flex flex-wrap gap-4">
                <input
                    value={activeTab === "gate" ? gateSearch : systemSearch}
                    onChange={(e) => {
                        if (activeTab === "gate") {
                            setGateSearch(e.target.value);
                            setGatePage(1);
                        } else {
                            setSystemSearch(e.target.value);
                            setSystemPage(1);
                        }
                    }}
                    placeholder={
                        activeTab === "gate"
                            ? "Search by plate number or owner name..."
                            : "Search by username, event, or IP..."
                    }
                    className="min-w-[220px] flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
            </div>

            {/* Content Tab 1: Gate Activity */}
            {activeTab === "gate" && (
                gateLoading ? (
                    <ActivityLogsSkeleton />
                ) : (
                    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                                <thead className="bg-zinc-50 dark:bg-zinc-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Plate Number</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Owner Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Direction</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                                    {gateLogs.length > 0 ? (
                                        gateLogs.map((log) => (
                                            <tr key={log.gate_log_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                                                <td className="whitespace-nowrap px-6 py-4 font-mono font-semibold text-zinc-900 dark:text-zinc-100">{log.plate_number}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{log.owner_name ?? "N/A"}</td>
                                                <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{log.direction === "IN" ? "Entry" : "Exit"}</td>
                                                <td className="whitespace-nowrap px-6 py-4"><GateStatusBadge status={log.status} /></td>
                                                <td className="whitespace-nowrap px-6 py-4 text-zinc-600 dark:text-zinc-400">{new Date(log.logged_at).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No gate activity logs found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <Pagination
                            currentPage={gatePage}
                            lastPage={gateLastPage}
                            total={gateTotal}
                            from={gateFrom}
                            to={gateTo}
                            onPageChange={(newPage) => setGatePage(newPage)}
                            loading={gateLoading}
                            itemName="gate logs"
                            maxVisiblePages={10}
                        />
                    </div>
                )
            )}

            {/* Content Tab 2: System Activity */}
            {activeTab === "system" && (
                systemLoading ? (
                    <ActivityLogsSkeleton />
                ) : (
                    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                                <thead className="bg-zinc-50 dark:bg-zinc-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Timestamp</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Event</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">User / Account</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                                    {systemLogs.length > 0 ? (
                                        systemLogs.map((log) => (
                                            <tr key={log.activity_log_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                                                <td className="whitespace-nowrap px-6 py-4 text-zinc-600 dark:text-zinc-400">{new Date(log.created_at).toLocaleString()}</td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                                                        {log.event_type.replace(/_/g, " ")}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                                    {log.user ? `${log.user.first_name} ${log.user.last_name}` : log.username_attempted || "—"}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-zinc-600 dark:text-zinc-400 capitalize">
                                                    {log.user?.role?.replace(/_/g, " ") || "—"}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                                    {log.ip_address || "—"}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No system activity logs found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <Pagination
                            currentPage={systemPage}
                            lastPage={systemLastPage}
                            total={systemTotal}
                            from={systemFrom}
                            to={systemTo}
                            onPageChange={(newPage) => setSystemPage(newPage)}
                            loading={systemLoading}
                            itemName="activity logs"
                            maxVisiblePages={10}
                        />
                    </div>
                )
            )}
        </div>
    );
};

const GateStatusBadge = ({ status }: { status: string }) => {
    const tone = status === "authorized"
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tone}`}>
            {status}
        </span>
    );
};

export default ActivityLogsPage;
