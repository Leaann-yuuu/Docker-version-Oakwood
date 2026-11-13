import type { FC } from 'react'

export interface AdminPaginationProps {
  currentPage: number
  lastPage: number
  total: number
  from?: number | null
  to?: number | null
  onPageChange: (page: number) => void
  loading?: boolean
  itemName?: string
  maxVisiblePages?: number
}

const ChevronLeftIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

export const AdminPagination: FC<AdminPaginationProps> = ({
  currentPage,
  lastPage,
  total,
  from,
  to,
  onPageChange,
  loading = false,
  itemName = 'logs',
  maxVisiblePages = 10,
}) => {
  const getPageNumbers = (): number[] => {
    const safeLastPage = Math.max(1, lastPage)
    if (safeLastPage <= maxVisiblePages) {
      return Array.from({ length: safeLastPage }, (_, i) => i + 1)
    }

    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let end = start + maxVisiblePages - 1

    if (end > safeLastPage) {
      end = safeLastPage
      start = Math.max(1, end - maxVisiblePages + 1)
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  const pages = getPageNumbers()
  const effectiveFrom = from ?? (total > 0 ? (currentPage - 1) * 10 + 1 : 0)
  const effectiveTo = to ?? (total > 0 ? Math.min(total, currentPage * 10) : 0)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-200 dark:border-white/10 px-5 py-3.5 bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {total > 0 ? (
          <>
            Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{effectiveFrom}</span> to{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{effectiveTo}</span> of{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{total}</span> {itemName}
          </>
        ) : (
          <span>No {itemName} found</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeftIcon />
          <span>Previous</span>
        </button>

        {pages.map((pageNum) => {
          const isActive = pageNum === currentPage
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              disabled={loading || isActive}
              className={`min-w-[32px] h-8 rounded-lg px-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-emerald-600 text-white font-bold cursor-default shadow-xs'
                  : 'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              {pageNum}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= lastPage || loading}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <span>Next</span>
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  )
}

export default AdminPagination

