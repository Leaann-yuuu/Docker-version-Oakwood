import { useState } from 'react'
import { useGuards } from '../../hooks/useGuards'
import GuardDetailsModal from './GuardDetails'
import AdminDataTable, { AdminTableCell, AdminTableRow } from '../UI/AdminDataTable'
import { AdminInput, AdminSectionTitle } from '../UI/AdminPanelShell'
import type { GuardUser } from '../../services/guardApi'

type StaffRole = 'security_guard' | 'resident'

const roleTabs: { value: StaffRole; label: string }[] = [
  { value: 'security_guard', label: 'Security Guards' },
  { value: 'resident', label: 'Residents' },
]

const roleLabel = (role: string) => (role === 'resident' ? 'Resident' : 'Security Guard')

const StaffTableSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="overflow-x-auto rounded-lg border border-white/5 bg-[#18181b]">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-[#202024] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-white/5">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Username</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="px-6 py-4"><div className="h-4 w-36 rounded bg-zinc-800" /></td>
                <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-zinc-800" /></td>
                <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-zinc-800" /></td>
                <td className="px-6 py-4"><div className="h-4 w-40 rounded bg-zinc-800" /></td>
                <td className="px-6 py-4"><div className="h-6 w-12 rounded bg-zinc-800" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const GuardsList = () => {
  const [search, setSearch] = useState('')
  const { guards, loading, error, refresh } = useGuards(search)
  const [selectedRole, setSelectedRole] = useState<StaffRole>('security_guard')
  const [selectedStaff, setSelectedStaff] = useState<GuardUser | null>(null)
  const staffUsers = guards.filter((user) => user.role === 'security_guard' || user.role === 'resident')
  const filteredStaff = staffUsers.filter((user) => user.role === selectedRole)
  const counts = {
    security_guard: staffUsers.filter((user) => user.role === 'security_guard').length,
    resident: staffUsers.filter((user) => user.role === 'resident').length,
  }

  return (
    <div className="relative space-y-5">
      <AdminSectionTitle
        title="Staff Users"
        description="Security guards and residents registered from the client portal."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminInput
          className="max-w-md"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="inline-flex w-full rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800/80 p-1 sm:w-auto transition-colors">
          {roleTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedRole(tab.value)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none cursor-pointer ${
                selectedRole === tab.value
                  ? 'bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
              <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold ${
                selectedRole === tab.value
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}>
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <StaffTableSkeleton />
      ) : (
        <AdminDataTable
          columns={['Name', 'Role', 'Username', 'Email', 'Actions']}
          isEmpty={filteredStaff.length === 0}
          emptyMessage={`No ${roleLabel(selectedRole).toLowerCase()} users found.`}
        >
          {filteredStaff.map((guard) => (
            <AdminTableRow key={guard.user_id}>
              <AdminTableCell>
                {[guard.first_name, guard.middle_name, guard.last_name].filter(Boolean).join(' ')}
              </AdminTableCell>
              <AdminTableCell muted>{roleLabel(guard.role)}</AdminTableCell>
              <AdminTableCell mono>{guard.username}</AdminTableCell>
              <AdminTableCell muted>{guard.email ?? 'N/A'}</AdminTableCell>
              <AdminTableCell>
                <button
                  type="button"
                  onClick={() => setSelectedStaff(guard)}
                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  View details
                </button>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminDataTable>
      )}

      <GuardDetailsModal
        isOpen={selectedStaff !== null}
        user={selectedStaff}
        onClose={() => setSelectedStaff(null)}
        onUpdate={refresh}
      />
    </div>
  )
}

export default GuardsList
