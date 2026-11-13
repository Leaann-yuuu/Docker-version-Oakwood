import { NavLink, Route, Routes } from 'react-router-dom'
import AccessLogs from '../components/Reports/AccessLogs'
import ActivityLogsReport from '../components/Reports/ActivityLogsReport'
import SecurityReports from '../components/Reports/SecurityReports'
import { AdminPanelHeader, AdminTabClass } from '../components/UI/AdminPanelShell'

const ReportsPage = () => (
  <div className="space-y-6">
    <AdminPanelHeader
      title="Activity Logs"
      description="Monitor portal authentication, gate access, and security reports."
    />

    <nav className="flex flex-wrap gap-2">
      <NavLink to="/reports" className={AdminTabClass} end>
        Activity Logs
      </NavLink>
      <NavLink to="/reports/access" className={AdminTabClass}>
        Access Logs
      </NavLink>
      <NavLink to="/reports/security" className={AdminTabClass}>
        Security Reports
      </NavLink>
    </nav>

    <Routes>
      <Route index element={<ActivityLogsReport />} />
      <Route path="access" element={<AccessLogs />} />
      <Route path="security" element={<SecurityReports />} />
    </Routes>
  </div>
)

export default ReportsPage
