import type { ReactNode } from 'react'

interface AdminDataTableProps {
  columns: string[]
  children: ReactNode
  emptyMessage?: string
  isEmpty?: boolean
  colSpan?: number
}

const AdminDataTable = ({
  columns,
  children,
  emptyMessage = 'No records found.',
  isEmpty = false,
  colSpan,
}: AdminDataTableProps) => (
  <div className="admin-table-wrap overflow-x-auto">
    <table className="admin-table w-full text-sm">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              className="px-5 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-[0.12em] text-zinc-700 dark:text-zinc-200"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isEmpty ? (
          <tr>
            <td colSpan={colSpan ?? columns.length} className="px-5 py-12 text-center text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          children
        )}
      </tbody>
    </table>
  </div>
)

export const AdminTableRow = ({ children }: { children: ReactNode }) => (
  <tr className="admin-table-row">{children}</tr>
)

export const AdminTableCell = ({
  children,
  accent,
  mono,
  muted,
  className = '',
}: {
  children: ReactNode
  accent?: boolean
  mono?: boolean
  muted?: boolean
  className?: string
}) => (
  <td
    className={`px-5 py-3.5 align-middle ${
      accent
        ? 'text-emerald-700 dark:text-emerald-400 font-bold'
        : muted
          ? 'text-zinc-600 dark:text-zinc-400 font-medium'
          : 'text-zinc-900 dark:text-zinc-100 font-medium'
    } ${mono ? 'font-mono text-[13px]' : ''} ${className}`}
  >
    {children}
  </td>
)

export const AdminStatusBadge = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'success' | 'danger' | 'neutral' | 'warning'
}) => {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold'
      : tone === 'success'
        ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
        : tone === 'warning'
          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold'
          : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 font-semibold'

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-[12px] capitalize leading-none ${toneClass}`}>
      {children}
    </span>
  )
}

export default AdminDataTable
