import { useEffect, useMemo, useState } from "react";
import GateAccessService from "../../services/GateAccessService";
import type { TrafficChart } from "../../interfaces/GateInterface";

const getBezierPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) / 3;
        const cpY1 = p0.y;
        const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
        const cpY2 = p1.y;
        d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
};

const getFillPath = (points: { x: number; y: number }[], height: number) => {
    const linePath = getBezierPath(points);
    if (!linePath) return "";
    return `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
};

const ReportsSkeleton = () => (
    <div className="animate-pulse space-y-6">
        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 space-y-4">
            <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-56 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-end justify-between p-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full flex justify-center gap-1.5 h-32 items-end">
                            <div className="w-4 rounded bg-zinc-200 dark:bg-zinc-700 h-24" />
                            <div className="w-4 rounded bg-zinc-200 dark:bg-zinc-700 h-12" />
                        </div>
                        <div className="h-3 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                ))}
            </div>
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4 rounded bg-zinc-50 p-3 dark:bg-zinc-900">
                        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                        <div className="flex gap-4">
                            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
                            <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
                            <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    </div>
);

const ReportsPage = () => {
    const [period, setPeriod] = useState("daily");
    const [chart, setChart] = useState<TrafficChart | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const itemsPerPage = 5;

    // Export range and status filters
    const [exportStatus, setExportStatus] = useState<string>("unauthorized");
    const [useCustomRange, setUseCustomRange] = useState<boolean>(false);
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [isExporting, setIsExporting] = useState<boolean>(false);

    useEffect(() => {
        GateAccessService.trafficChart(period)
            .then((res) => {
                setChart(res.data);
                setCurrentPage(0);
            })
            .finally(() => setLoading(false));
    }, [period]);

    const stats = useMemo(() => {
        const authorized = chart?.authorized.reduce((sum, value) => sum + value, 0) ?? 0;
        const unauthorized = chart?.unauthorized.reduce((sum, value) => sum + value, 0) ?? 0;

        return {
            total: authorized + unauthorized,
            authorized,
            unauthorized,
        };
    }, [chart]);

    const getExportFilters = () => {
        const filters: { status?: string; period?: string; start_date?: string; end_date?: string } = {};
        if (exportStatus && exportStatus !== "all") {
            filters.status = exportStatus;
        }
        if (useCustomRange) {
            if (startDate) filters.start_date = startDate;
            if (endDate) filters.end_date = endDate;
        } else {
            filters.period = period;
        }
        return filters;
    };

    const downloadCsv = async () => {
        try {
            setIsExporting(true);
            const filters = getExportFilters();
            const res = await GateAccessService.exportCsv(filters);
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
            const anchor = document.createElement("a");
            anchor.href = url;
            const statusTag = exportStatus !== "all" ? `_${exportStatus}` : "";
            const rangeTag = useCustomRange ? `_${startDate || "start"}_to_${endDate || "now"}` : `_${period}`;
            anchor.download = `gate_logs${statusTag}${rangeTag}.csv`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export CSV error:", err);
        } finally {
            setIsExporting(false);
        }
    };

    const downloadPdf = async () => {
        try {
            setIsExporting(true);
            const filters = getExportFilters();
            const res = await GateAccessService.exportPdf(filters);
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/html" }));
            window.open(url, "_blank");
        } catch (err) {
            console.error("Export PDF error:", err);
        } finally {
            setIsExporting(false);
        }
    };

    const maxVal = chart ? Math.max(...chart.authorized, ...chart.unauthorized, 1) : 1;

    const startIdx = currentPage * itemsPerPage;
    const paginatedLabels = chart ? chart.labels.slice(startIdx, startIdx + itemsPerPage) : [];
    const paginatedAuthorized = chart ? chart.authorized.slice(startIdx, startIdx + itemsPerPage) : [];
    const paginatedUnauthorized = chart ? chart.unauthorized.slice(startIdx, startIdx + itemsPerPage) : [];
    const totalPages = chart ? Math.ceil(chart.labels.length / itemsPerPage) : 0;

    const chartPoints = useMemo(() => {
        if (paginatedLabels.length === 0) return { auth: [], unauth: [] };
        const n = paginatedLabels.length;
        
        return {
            auth: paginatedLabels.map((_, i) => ({
                x: n > 1 ? 40 + (i / (n - 1)) * 520 : 300,
                y: 160 - ((paginatedAuthorized[i] ?? 0) / maxVal) * 120,
            })),
            unauth: paginatedLabels.map((_, i) => ({
                x: n > 1 ? 40 + (i / (n - 1)) * 520 : 300,
                y: 160 - ((paginatedUnauthorized[i] ?? 0) / maxVal) * 120,
            })),
        };
    }, [paginatedLabels, paginatedAuthorized, paginatedUnauthorized, maxVal]);

    const activeIdx = hoveredIdx !== null ? hoveredIdx : (paginatedLabels.length > 0 ? paginatedLabels.length - 1 : 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Reports & Analytics</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">View gate traffic statistics and export logs</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={downloadCsv}
                        disabled={isExporting}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-700/25 transition hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                    >
                        {isExporting ? "Exporting..." : "Export CSV"}
                    </button>
                    <button
                        type="button"
                        onClick={downloadPdf}
                        disabled={isExporting}
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                    >
                        {isExporting ? "Exporting..." : "Export PDF"}
                    </button>
                </div>
            </div>

            {/* Export Range & Status Selector Bar */}
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Export Logs Filter (Status)
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            {[
                                { value: "unauthorized", label: "Unauthorized Logs", count: stats.unauthorized, tone: "red" },
                                { value: "authorized", label: "Authorized Logs", count: stats.authorized, tone: "green" },
                                { value: "all", label: "All Logs", count: stats.total, tone: "neutral" },
                            ].map((s) => {
                                const isSel = exportStatus === s.value;
                                return (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setExportStatus(s.value)}
                                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                                            isSel
                                                ? s.tone === "red"
                                                    ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30 ring-2 ring-rose-500/50"
                                                    : s.tone === "green"
                                                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/50"
                                                    : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                        }`}
                                    >
                                        <span>{s.label}</span>
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                                            isSel ? "bg-black/25 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                                        }`}>
                                            {s.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setUseCustomRange(!useCustomRange)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition border cursor-pointer ${
                                useCustomRange
                                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-500/80 dark:text-emerald-300"
                                    : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                        >
                            {useCustomRange ? "✓ Custom Date Range" : "+ Custom Date Range"}
                        </button>
                    </div>
                </div>

                {/* Custom Date Range Picker */}
                {useCustomRange && (
                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Custom Date Range:
                        </span>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setStartDate("");
                                    setEndDate("");
                                }}
                                className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                )}

                {/* Active export target indicator */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <div>
                        Export Target:{" "}
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase">
                            {exportStatus === "unauthorized" ? "Unauthorized Logs" : exportStatus === "authorized" ? "Authorized Logs" : "All Logs"}
                        </span>
                        {" "}&bull; Range:{" "}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {useCustomRange
                                ? startDate && endDate
                                    ? `${startDate} to ${endDate}`
                                    : startDate
                                    ? `From ${startDate}`
                                    : endDate
                                    ? `Until ${endDate}`
                                    : "All Time (Custom Range)"
                                : period === "daily"
                                ? "Days (Today)"
                                : period === "weekly"
                                ? "Weeks (This Week)"
                                : "Year (This Year)"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Date Range Filter</span>
                <div className="inline-flex rounded-full border border-zinc-200/80 bg-zinc-100/70 p-1 dark:border-zinc-700/60 dark:bg-zinc-900/60 w-fit">
                    {[
                        { value: 'daily', label: 'Days' },
                        { value: 'weekly', label: 'Weeks' },
                        { value: 'monthly', label: 'Year' },
                    ].map((tab) => {
                        const isActive = period === tab.value;
                        return (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => {
                                    setLoading(true);
                                    setPeriod(tab.value);
                                }}
                                className={`rounded-full px-6 py-2 text-sm font-bold transition-all duration-200 cursor-pointer ${
                                    isActive
                                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                                        : 'text-zinc-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Stat
                    label="Total Entries"
                    value={stats.total}
                    onClick={() => setExportStatus("all")}
                    active={exportStatus === "all"}
                />
                <Stat
                    label="Authorized"
                    value={stats.authorized}
                    tone="green"
                    onClick={() => setExportStatus("authorized")}
                    active={exportStatus === "authorized"}
                />
                <Stat
                    label="Unauthorized"
                    value={stats.unauthorized}
                    tone="red"
                    onClick={() => setExportStatus("unauthorized")}
                    active={exportStatus === "unauthorized"}
                />
            </div>

            {loading ? <ReportsSkeleton /> : chart && (() => {
                const activeX = chartPoints.auth[activeIdx]?.x ?? 300;
                const activeAuthY = chartPoints.auth[activeIdx]?.y ?? 160;
                const activeUnauthY = chartPoints.unauth[activeIdx]?.y ?? 160;
                const authPath = chartPoints.auth.length > 0 ? getBezierPath(chartPoints.auth) : "";
                const authFillPath = chartPoints.auth.length > 0 ? getFillPath(chartPoints.auth, 160) : "";
                const unauthPath = chartPoints.unauth.length > 0 ? getBezierPath(chartPoints.unauth) : "";
                const unauthFillPath = chartPoints.unauth.length > 0 ? getFillPath(chartPoints.unauth, 160) : "";

                return (
                    <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#18181b] transition-colors">
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                    {period === 'daily' ? 'Daily Statistics' : period === 'weekly' ? 'Weekly Statistics' : 'Monthly Statistics'}
                                </h3>
                                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
                                    Authorized and unauthorized vehicle entry trends.
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                                    {stats.total.toLocaleString()}
                                </span>
                                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-0.5">
                                    Total Entries
                                </p>
                            </div>
                        </div>

                        {/* Line Chart Grid */}
                        <div className="mb-6 relative rounded-xl bg-zinc-50 border border-zinc-200/80 p-4 overflow-hidden dark:bg-[#121212]/50 dark:border-white/5 transition-colors">
                            <svg viewBox="0 0 600 200" className="w-full overflow-visible">
                                <defs>
                                    <linearGradient id="authLineGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" />
                                        <stop offset="100%" stopColor="#059669" />
                                    </linearGradient>
                                    <linearGradient id="authAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                                    </linearGradient>

                                    <linearGradient id="unauthLineGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" />
                                        <stop offset="100%" stopColor="#dc2626" />
                                    </linearGradient>
                                    <linearGradient id="unauthAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.00" />
                                    </linearGradient>
                                </defs>

                                {/* Horizontal Grid lines */}
                                <line x1={40} y1={40} x2={560} y2={40} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
                                <line x1={40} y1={100} x2={560} y2={100} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
                                <line x1={40} y1={160} x2={560} y2={160} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

                                {/* Filled Areas */}
                                {authFillPath && <path d={authFillPath} fill="url(#authAreaGrad)" />}
                                {unauthFillPath && <path d={unauthFillPath} fill="url(#unauthAreaGrad)" />}

                                {/* Path Lines */}
                                {authPath && (
                                    <path
                                        d={authPath}
                                        fill="none"
                                        stroke="url(#authLineGrad)"
                                        strokeWidth={3}
                                        strokeLinecap="round"
                                    />
                                )}
                                {unauthPath && (
                                    <path
                                        d={unauthPath}
                                        fill="none"
                                        stroke="url(#unauthLineGrad)"
                                        strokeWidth={3}
                                        strokeLinecap="round"
                                    />
                                )}

                                {/* Vertical active indicator line */}
                                {paginatedLabels.length > 0 && (
                                    <line
                                        x1={activeX}
                                        y1={20}
                                        x2={activeX}
                                        y2={160}
                                        stroke="#10b981"
                                        strokeWidth={1.5}
                                        strokeDasharray="3 3"
                                        opacity="0.8"
                                    />
                                )}

                                {/* Highlighted Dots */}
                                {paginatedLabels.length > 0 && (
                                    <>
                                        <circle
                                            cx={activeX}
                                            cy={activeAuthY}
                                            r={6}
                                            fill="#10b981"
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                        />
                                        <circle
                                            cx={activeX}
                                            cy={activeUnauthY}
                                            r={6}
                                            fill="#ef4444"
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                        />
                                    </>
                                )}

                                {/* Tooltip bubble */}
                                {paginatedLabels.length > 0 && (
                                    <g transform={`translate(${activeX}, 30)`}>
                                        <rect
                                            x={-75}
                                            y={-18}
                                            width={150}
                                            height={26}
                                            rx={13}
                                            fill="#050806"
                                            stroke="#10b981"
                                            strokeWidth={1.5}
                                        />
                                        <text
                                            x={0}
                                            y={-1}
                                            textAnchor="middle"
                                            fill="#ffffff"
                                            className="text-[10px] font-bold tracking-wide"
                                        >
                                            Auth: {paginatedAuthorized[activeIdx]} | Unauth: {paginatedUnauthorized[activeIdx]}
                                        </text>
                                    </g>
                                )}

                                {/* X-Axis Labels */}
                                {paginatedLabels.map((label, i) => {
                                    const pt = chartPoints.auth[i];
                                    if (!pt) return null;
                                    const isActive = activeIdx === i;
                                    return (
                                        <text
                                            key={label}
                                            x={pt.x}
                                            y={185}
                                            textAnchor="middle"
                                            className={`text-[11px] transition-colors font-semibold ${
                                                isActive ? "fill-emerald-600 dark:fill-emerald-400 font-bold" : "fill-zinc-500 dark:fill-zinc-400"
                                            }`}
                                        >
                                            {label}
                                        </text>
                                    );
                                })}

                                {/* Hover detection zones */}
                                {chartPoints.auth.map((pt, i) => (
                                    <rect
                                        key={i}
                                        x={pt.x - 25}
                                        y={0}
                                        width={50}
                                        height={180}
                                        fill="transparent"
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHoveredIdx(i)}
                                    />
                                ))}
                            </svg>
                        </div>
                        <div className="space-y-2">
                            {paginatedLabels.length > 0 ? paginatedLabels.map((label, index) => {
                                const authorized = paginatedAuthorized[index] ?? 0;
                                const unauthorized = paginatedUnauthorized[index] ?? 0;

                                return (
                                    <div key={label} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 dark:border-white/5 dark:bg-zinc-900/90 transition-colors">
                                        <span className="font-semibold text-zinc-900 dark:text-white">{label}</span>
                                        <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-300 font-medium">
                                            <span>Total: {authorized + unauthorized}</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Authorized: {authorized}</span>
                                            <span className="text-rose-600 dark:text-rose-400 font-semibold">Unauthorized: {unauthorized}</span>
                                        </div>
                                    </div>
                                );
                            }) : <p className="py-4 text-center font-medium text-zinc-500 dark:text-zinc-400">No data available for selected period</p>}
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between border-t border-zinc-200 dark:border-white/5 pt-4">
                                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={currentPage === 0}
                                        onClick={() => setCurrentPage((p) => p - 1)}
                                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        disabled={currentPage >= totalPages - 1}
                                        onClick={() => setCurrentPage((p) => p + 1)}
                                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                );
            })()}
        </div>
    );
};

const Stat = ({
    label,
    value,
    tone,
    onClick,
    active,
}: {
    label: string;
    value: number;
    tone?: "green" | "red";
    onClick?: () => void;
    active?: boolean;
}) => (
    <div
        onClick={onClick}
        title={onClick ? "Click to set as export filter" : undefined}
        className={`rounded-xl border p-5 shadow-sm transition-all ${onClick ? "cursor-pointer" : ""} ${
            active
                ? tone === "red"
                    ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-500"
                    : tone === "green"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500"
                    : "border-zinc-400 bg-zinc-50 dark:bg-zinc-800 ring-2 ring-zinc-500"
                : "border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600"
        }`}
    >
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{label}</h3>
            {active && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                    Export Filter
                </span>
            )}
        </div>
        <p className={`mt-2 text-3xl font-extrabold ${tone === "green" ? "text-emerald-600 dark:text-emerald-400" : tone === "red" ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
    </div>
);

export default ReportsPage;
