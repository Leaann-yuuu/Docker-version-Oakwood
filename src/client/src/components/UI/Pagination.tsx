import type { FC } from "react";

export interface PaginationProps {
    currentPage: number;
    lastPage: number;
    total: number;
    from?: number | null;
    to?: number | null;
    onPageChange: (page: number) => void;
    loading?: boolean;
    itemName?: string;
    maxVisiblePages?: number;
}

const ChevronLeftIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
);

const ChevronRightIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

export const Pagination: FC<PaginationProps> = ({
    currentPage,
    lastPage,
    total,
    from,
    to,
    onPageChange,
    loading = false,
    itemName = "logs",
    maxVisiblePages = 10,
}) => {
    // Determine the list of page numbers to show (up to 10 page buttons)
    const getPageNumbers = (): number[] => {
        const safeLastPage = Math.max(1, lastPage);
        if (safeLastPage <= maxVisiblePages) {
            return Array.from({ length: safeLastPage }, (_, i) => i + 1);
        }

        // Keep page 1 up to 10 initially, or sliding window centered on currentPage
        let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let end = start + maxVisiblePages - 1;

        if (end > safeLastPage) {
            end = safeLastPage;
            start = Math.max(1, end - maxVisiblePages + 1);
        }

        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    };

    const pages = getPageNumbers();
    const effectiveFrom = from ?? (total > 0 ? (currentPage - 1) * 10 + 1 : 0);
    const effectiveTo = to ?? (total > 0 ? Math.min(total, currentPage * 10) : 0);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-200 bg-white/95 px-6 py-3.5 dark:border-zinc-700 dark:bg-zinc-800/95">
            <div className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                {total > 0 ? (
                    <>
                        Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{effectiveFrom}</span> to{" "}
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{effectiveTo}</span> of{" "}
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{total}</span> {itemName}
                    </>
                ) : (
                    <span>No {itemName} found</span>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:disabled:hover:bg-zinc-800 cursor-pointer"
                    aria-label="Previous page"
                >
                    <ChevronLeftIcon />
                    <span>Previous</span>
                </button>

                {/* Numbered Page Buttons (1 up to 10) */}
                {pages.map((pageNum) => {
                    const isActive = pageNum === currentPage;
                    return (
                        <button
                            key={pageNum}
                            type="button"
                            onClick={() => onPageChange(pageNum)}
                            disabled={loading || isActive}
                            className={`min-w-[32px] h-8 rounded-lg px-2.5 text-xs font-semibold transition cursor-pointer ${
                                isActive
                                    ? "bg-emerald-600 text-white shadow-xs font-bold cursor-default"
                                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 active:scale-95 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            }`}
                            aria-label={`Page ${pageNum}`}
                            aria-current={isActive ? "page" : undefined}
                        >
                            {pageNum}
                        </button>
                    );
                })}

                {/* Next Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= lastPage || loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:disabled:hover:bg-zinc-800 cursor-pointer"
                    aria-label="Next page"
                >
                    <span>Next</span>
                    <ChevronRightIcon />
                </button>
            </div>
        </div>
    );
};

export default Pagination;

