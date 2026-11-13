import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import GateAccessService from "../../services/GateAccessService";
import type { ResidentRow } from "../../interfaces/GateInterface";
import Spinner from "../../components/Spinner/Spinner";

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
    const vehiclesList = (resident.vehicles && resident.vehicles.length > 0)
        ? resident.vehicles
        : (resident.plate_number ? [{
            plate_number: resident.plate_number,
            car_model: resident.car_model || "N/A",
            car_color: resident.car_color || "N/A",
            is_primary: true,
        }] : []);

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

                    {/* Content */}
                    <div className="max-h-[72vh] overflow-y-auto p-6 space-y-6">
                        {/* Personal Details Grid */}
                        <div>
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                Personal Information
                            </h4>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <InfoItem label="Email Address" value={resident.email || "N/A"} />
                                <InfoItem label="Contact Number" value={resident.contact_number || "N/A"} />
                                <InfoItem label="Gender" value={resident.gender?.gender || "N/A"} />
                                <InfoItem label="Birthdate" value={resident.birth_date || "N/A"} />
                                <InfoItem label="Age" value={resident.age ? String(resident.age) : "N/A"} />
                                <InfoItem label="Address" value={resident.address || "N/A"} />
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
                                                        {vehicle.car_model || "Car Model Unspecified"}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                        Color: {vehicle.car_color || "N/A"}
                                                    </p>
                                                </div>
                                            </div>
                                            {vehicle.is_primary && (
                                                <span className="self-start sm:self-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    Primary Vehicle
                                                </span>
                                            )}
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
