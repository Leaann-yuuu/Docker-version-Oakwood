import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import GateAccessService from "../../services/GateAccessService";
import type { ResidentRow } from "../../interfaces/GateInterface";
import Spinner from "../../components/Spinner/Spinner";

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080/api").replace(/\/api\/?$/, "");

const resolveDocumentUrl = (path?: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("/api/")) return `${BACKEND_ORIGIN}${path}`;
    const clean = path.replace(/^\/+/, "");
    if (clean.startsWith("img/vehicles/or_cr/")) {
        return `${BACKEND_ORIGIN}/api/resident-documents/or_cr/${clean.split("/").pop()}`;
    }
    if (clean.startsWith("img/vehicles/license/")) {
        return `${BACKEND_ORIGIN}/api/resident-documents/license/${clean.split("/").pop()}`;
    }
    return `${BACKEND_ORIGIN}/storage/${clean}`;
};

const ResidentsSkeleton = () => (
    <div className="animate-pulse space-y-4">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                        <Head>Name</Head>
                        <Head>Plate Number</Head>
                        <Head>Contact</Head>
                        <Head>Address</Head>
                        <Head>Actions</Head>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i}>
                            <td className="px-6 py-4"><div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4"><div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700" /></td>
                            <td className="px-6 py-4">
                                <div className="h-6 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const ResidentsPage = () => {
    const [residents, setResidents] = useState<ResidentRow[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedResident, setSelectedResident] = useState<ResidentRow | null>(null);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadResidents = useCallback((pageNum: number, query: string, append = false) => {
        if (pageNum === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        GateAccessService.loadResidents(pageNum, query)
            .then((res) => {
                const fetchedData = res.data.residents.data ?? [];
                const lastPage = res.data.residents.last_page ?? 1;

                if (append) {
                    setResidents((prev) => [...prev, ...fetchedData]);
                } else {
                    setResidents(fetchedData);
                }

                setHasMore(pageNum < lastPage);
                setPage(pageNum);
            })
            .finally(() => {
                setLoading(false);
                setLoadingMore(false);
            });
    }, []);

    useEffect(() => {
        loadResidents(1, "");
    }, [loadResidents]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            loadResidents(1, search);
        }, 250);

        return () => window.clearTimeout(handle);
    }, [loadResidents, search]);

    const loadNextPage = () => {
        if (loading || loadingMore || !hasMore) return;
        loadResidents(page + 1, search, true);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
        if (isNearBottom && hasMore && !loadingMore && !loading) {
            loadNextPage();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Residents Management</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage resident profiles and information</p>
                </div>
            </div>

            <div className="space-y-4">
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, plate number, or contact..."
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 transition focus:border-transparent focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />

                {loading ? <ResidentsSkeleton /> : (
                    <div className="space-y-4">
                        <div 
                            onScroll={handleScroll}
                            className="max-h-[420px] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        >
                            <table className="w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700 relative">
                                <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
                                    <tr>
                                        <Head>Name</Head>
                                        <Head>Plate Number</Head>
                                        <Head>Contact</Head>
                                        <Head>Address</Head>
                                        <Head>Actions</Head>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                                    {residents.length > 0 ? residents.map((resident) => (
                                        <tr key={resident.user_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                                            <td className="whitespace-nowrap px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{fullName(resident)}</td>
                                            <td className="whitespace-nowrap px-6 py-4 font-mono text-zinc-900 dark:text-zinc-100">{resident.plate_number || "-"}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-zinc-900 dark:text-zinc-100">{resident.contact_number || "-"}</td>
                                            <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{limitText(resident.address || "-", 35)}</td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedResident(resident)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                                                >
                                                    <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No residents found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {hasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    type="button"
                                    onClick={loadNextPage}
                                    disabled={loadingMore}
                                    className="px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {loadingMore ? (
                                        <div className="flex items-center gap-2">
                                            <Spinner size="sm" />
                                            <span>Loading more residents...</span>
                                        </div>
                                    ) : (
                                        "Scroll down or click here to load more"
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedResident && (
                <ResidentDetailsModal
                    resident={selectedResident}
                    onClose={() => setSelectedResident(null)}
                />
            )}
        </div>
    );
};

const ResidentDetailsModal = ({
    resident,
    onClose,
}: {
    resident: ResidentRow;
    onClose: () => void;
}) => {
    const [previewDoc, setPreviewDoc] = useState<{
        residentName: string;
        activeTab: "or_cr" | "valid_id" | "both";
        orCrUrl: string | null;
        validIdUrl: string | null;
        vehicleType?: string | null;
        plateNumber?: string | null;
    } | null>(null);

    const vehiclesList = (resident.vehicles && resident.vehicles.length > 0)
        ? resident.vehicles
        : (resident.plate_number ? [{
            plate_number: resident.plate_number,
            car_model: resident.car_model || "N/A",
            car_color: resident.car_color || "N/A",
            is_primary: true,
            or_cr_image: null,
            license_image: null,
        }] : []);

    const primaryVeh = vehiclesList.find((v) => v.is_primary) || vehiclesList[0];
    const primaryOrCrUrl = resolveDocumentUrl(primaryVeh?.or_cr_image);
    const primaryValidIdUrl = resolveDocumentUrl(primaryVeh?.license_image);

    const openResidentDocs = (
        tab: "or_cr" | "valid_id" | "both",
        veh?: (typeof vehiclesList)[number]
    ) => {
        const target = veh || primaryVeh;
        setPreviewDoc({
            residentName: fullName(resident),
            activeTab: tab,
            orCrUrl: resolveDocumentUrl(target?.or_cr_image),
            validIdUrl: resolveDocumentUrl(target?.license_image),
            vehicleType: target?.car_model || resident.car_model,
            plateNumber: target?.plate_number || resident.plate_number,
        });
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-left">
                {/* Backdrop */}
                <button
                    type="button"
                    aria-label="Close modal"
                    onClick={onClose}
                    className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity cursor-pointer"
                />

                {/* Modal card */}
                <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 z-10 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold leading-tight">
                                    {fullName(resident)}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Resident Profile • @{resident.username || "resident"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => openResidentDocs("both")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
                            >
                                View OR/CR &amp; ID
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
                                aria-label="Close"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="max-h-[72vh] overflow-y-auto p-6 space-y-6">
                        {/* Personal Details Grid */}
                        <div>
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                Personal &amp; Verification Information
                            </h4>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <InfoItem label="Email Address" value={resident.email || "N/A"} />
                                <InfoItem label="Contact Number" value={resident.contact_number || "N/A"} />
                                <InfoItem label="Gender" value={resident.gender?.gender || "N/A"} />
                                <InfoItem label="Birthdate" value={resident.birth_date || "N/A"} />
                                <InfoItem label="Age" value={resident.age ? String(resident.age) : "N/A"} />
                                <InfoItem label="Address" value={resident.address || "N/A"} />
                                <InfoItem label="Vehicle Type" value={primaryVeh?.car_model || resident.car_model || "Not provided"} />
                                <InfoItem label="Plate Number" value={primaryVeh?.plate_number || resident.plate_number || "Not provided"} />
                                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:col-span-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Valid ID & OR/CR (Resident & Vehicle Verification)</p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openResidentDocs("both")}
                                            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25 transition cursor-pointer"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            View Valid ID & OR/CR
                                        </button>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${primaryOrCrUrl || primaryValidIdUrl ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                                            {primaryOrCrUrl || primaryValidIdUrl ? "Uploaded" : "No file"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Registered Vehicles / Car Info */}
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-2">
                                    <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11M5 11h14M5 11v6h14v-6" />
                                    </svg>
                                    Registered Vehicles ({vehiclesList.length})
                                </h4>
                            </div>

                            {vehiclesList.length > 0 ? (
                                <div className="space-y-2.5">
                                    {vehiclesList.map((vehicle, idx) => (
                                        <div
                                            key={vehicle.vehicle_id || idx}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-zinc-900 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-white shadow-xs dark:bg-zinc-800 dark:border dark:border-zinc-700">
                                                    {vehicle.plate_number}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                        {vehicle.car_model || "Vehicle Type Unspecified"}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                        Color: {vehicle.car_color || "N/A"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openResidentDocs("both", vehicle)}
                                                    className="rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25 transition cursor-pointer"
                                                >
                                                    View Valid ID & OR/CR
                                                </button>
                                                {vehicle.is_primary && (
                                                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        Primary Vehicle
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                    No registered vehicles found for this resident.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {previewDoc && (
                <div
                    className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
                    onClick={() => setPreviewDoc(null)}
                >
                    <div
                        className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 p-5 shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-white">
                                    {previewDoc.residentName} — Valid ID & OR/CR Verification
                                </h3>
                                <p className="mt-0.5 text-xs text-zinc-400">
                                    Vehicle Type: <span className="font-semibold text-zinc-200">{previewDoc.vehicleType || "Not provided"}</span>
                                    {" • "}
                                    Plate Number: <span className="font-mono font-semibold text-emerald-400">{previewDoc.plateNumber || "Not provided"}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewDoc(null)}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
                            <div className="flex flex-col rounded-xl border border-white/10 bg-zinc-950/70 p-3">
                                <div className="mb-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                                            Valid ID (Resident Verification)
                                        </span>
                                        {previewDoc.validIdUrl ? (
                                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                                Uploaded
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                                Not Uploaded
                                            </span>
                                        )}
                                    </div>
                                    {previewDoc.validIdUrl && (
                                        <a
                                            href={previewDoc.validIdUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition"
                                        >
                                            Open Full Image
                                        </a>
                                    )}
                                </div>
                                {previewDoc.validIdUrl ? (
                                    <div className="flex min-h-[260px] max-h-[65vh] items-center justify-center overflow-auto rounded-lg bg-black/70 p-2">
                                        <img
                                            src={previewDoc.validIdUrl}
                                            alt="Valid ID Document"
                                            className="max-h-[60vh] w-auto rounded-lg object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
                                        <p className="text-sm font-semibold text-zinc-300">No Valid ID Uploaded</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            This resident has not uploaded a Valid ID photo yet.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col rounded-xl border border-white/10 bg-zinc-950/70 p-3">
                                <div className="mb-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                                            Vehicle OR/CR Document
                                        </span>
                                        {previewDoc.orCrUrl ? (
                                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                                Uploaded
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                                Not Uploaded
                                            </span>
                                        )}
                                    </div>
                                    {previewDoc.orCrUrl && (
                                        <a
                                            href={previewDoc.orCrUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition"
                                        >
                                            Open Full Image
                                        </a>
                                    )}
                                </div>
                                {previewDoc.orCrUrl ? (
                                    <div className="flex min-h-[260px] max-h-[65vh] items-center justify-center overflow-auto rounded-lg bg-black/70 p-2">
                                        <img
                                            src={previewDoc.orCrUrl}
                                            alt="Vehicle OR/CR Document"
                                            className="max-h-[60vh] w-auto rounded-lg object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
                                        <p className="text-sm font-semibold text-zinc-300">No OR/CR Uploaded</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            This resident has not uploaded a Vehicle OR/CR photo yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

const InfoItem = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</p>
        <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 break-words">{value}</p>
    </div>
);

const Head = ({ children }: { children: ReactNode }) => (
    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{children}</th>
);

const fullName = (resident: ResidentRow) => [resident.first_name, resident.middle_name, resident.last_name].filter(Boolean).join(" ");
const limitText = (value: string, limit: number) => value.length > limit ? `${value.slice(0, limit)}...` : value;

export default ResidentsPage;
