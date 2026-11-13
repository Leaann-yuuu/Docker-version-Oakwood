import { useState } from 'react'
import { useSecurityActivityLogs } from '../../hooks/useReports'
import ActivityLogTable from '../UI/ActivityLogTable'
import { AdminInput, AdminSectionTitle, AdminSelect } from '../UI/AdminPanelShell'
import AdminPagination from '../UI/AdminPagination'

const ActivityLogsReport = () => {
  const [eventType, setEventType] = useState('')
  const [search, setSearch] = useState('')
  const { logs, loading, page, setPage, meta } = useSecurityActivityLogs({ event_type: eventType, search })

  return (
    <div className="space-y-5">
      <AdminSectionTitle
        title="Activity Logs"
        description="Authentication and portal activity across admin and security guard accounts."
      />

      <div className="flex flex-wrap gap-3">
        <AdminInput
          className="min-w-[220px] flex-1"
          placeholder="Search username, identifier, or IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AdminSelect value={eventType} onChange={(e) => setEventType(e.target.value)}>
          <option value="">All events</option>
          <option value="admin_portal_login_success">Admin Portal Login Success</option>
          <option value="admin_portal_login_failure">Admin Portal Login Failure</option>
          <option value="logout">Logout</option>
        </AdminSelect>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900">
        <ActivityLogTable logs={logs} loading={loading} hideIpAddress={true} hideContext={true} />
        <AdminPagination
          currentPage={page}
          lastPage={meta.lastPage}
          total={meta.total}
          from={meta.from}
          to={meta.to}
          onPageChange={(p) => setPage(p)}
          loading={loading}
          itemName="activity logs"
          maxVisiblePages={10}
        />
      </div>
    </div>
  )
}

export default ActivityLogsReport
