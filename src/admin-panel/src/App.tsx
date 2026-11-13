import { Navigate, NavLink, Outlet, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import AdminLogin from './components/Auth/AdminLogin'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './contexts/ThemeContext'
import { ThemeToggle } from './components/UI/ThemeToggle'
import AdminPage from './pages/AdminPage'
import GuardsPage from './pages/GuardsPage'
import NotificationsPage from './pages/NotificationsPage'
import ReportsPage from './pages/ReportsPage'
import { useEffect, useState } from 'react'
import AdminProfileModal from './components/Profile/AdminProfileModal'
import SignOutConfirmModal from './components/Auth/SignOutConfirmModal'
import SidebarHoverLabel from './components/Sidebar/SidebarHoverLabel'
import { usePersistedSidebarCollapsed } from './hooks/usePersistedSidebarCollapsed'
import { adminNotificationsApi } from './services/adminApi'
import PortalSkeleton from './components/Skeleton/PortalSkeleton'
import oakwoodLogo from './assets/oakwood-logo.png'
import oakwoodIcon from './assets/oakwood-icon.png'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'gate-admin-sidebar-collapsed'

const resolveProfilePictureUrl = (path?: string | null): string | null => {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
    return path
  }
  const cleanPath = path.replace(/^\/+/, "").replace(/^public\//, "")
  if (cleanPath.startsWith("storage/")) {
    return `http://127.0.0.1:8080/${cleanPath}`
  }
  return `http://127.0.0.1:8080/storage/${cleanPath}`
}

const HomeIcon = () => (
  <svg className="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)

const ChartBarIcon = () => (
  <svg className="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const BellIcon = () => (
  <svg className="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const UsersIcon = () => (
  <svg className="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)

const ChevronUpDownIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
  </svg>
)

const navLinkClass = (_isCollapsed: boolean) => ({ isActive }: { isActive: boolean }) =>
  `flex items-center px-3.5 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-200 ease-in-out ${
    isActive
      ? 'bg-emerald-600 dark:bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 font-bold'
      : 'text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium'
  }`

const ProtectedLayout = () => {
  const { user, loading, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = usePersistedSidebarCollapsed(SIDEBAR_COLLAPSED_STORAGE_KEY)
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return

    const loadUnreadCount = () => {
      adminNotificationsApi.getNotifications()
        .then((res) => {
          const list = Array.isArray(res.data.notifications)
            ? res.data.notifications
            : (res.data.notifications as any).data ?? []
          const unread = list.filter((n: any) => !n.is_read).length
          setUnreadCount(unread)
        })
        .catch(() => {})
    }

    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 15000)
    window.addEventListener('notifications_updated', loadUnreadCount)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('notifications_updated', loadUnreadCount)
    }
  }, [user])

  if (loading) {
    return <PortalSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const closeSidebar = () => {
    if (sidebarOpen && window.innerWidth < 1024) setSidebarOpen(false)
  }

  const handleLogoutRequest = () => {
    setProfileOpen(false)
    setSignOutConfirmOpen(true)
  }

  const handleLogoutConfirm = async () => {
    await logout()
    setSignOutConfirmOpen(false)
    navigate('/login', { replace: true })
  }

  const userInitials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'A'
  const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Admin User'
  const userName = userFullName
  const roleTitle = (user.role || 'ADMIN').toUpperCase() === 'ADMIN' ? 'SYSTEM ADMINISTRATOR' : (user.role || '').toUpperCase()

  return (
    <div className="min-h-screen bg-[#f8fbf9] dark:bg-[#050806] text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      {/* Mobile header */}
      <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-emerald-500/15 dark:border-emerald-500/20 bg-white/95 dark:bg-[#0a0e0c]/95 backdrop-blur-xl px-4 lg:hidden shadow-xs">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-xl p-2 text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
          aria-label="Toggle sidebar"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <p className="font-bold text-zinc-900 dark:text-white tracking-tight">Gate Security Admin</p>
        <div className="flex items-center">
          <ThemeToggle variant="compact" />
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar - White & Green / Black & Green Minimalist Theme */}
      <aside
        className={`fixed top-0 left-0 z-40 flex h-screen flex-col bg-white/95 dark:bg-[#0a0e0c]/95 backdrop-blur-xl border-r border-emerald-500/15 dark:border-emerald-500/20 shadow-[4px_0_24px_rgba(16,185,129,0.05)] dark:shadow-[4px_0_30px_rgba(0,0,0,0.8)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${isCollapsed ? 'w-[76px]' : 'w-[260px]'}`}
      >
        <div className="hidden border-b border-emerald-500/15 dark:border-emerald-500/20 px-3.5 py-2 lg:flex items-center justify-start h-[88px] shrink-0">
          <SidebarHoverLabel label={`${roleTitle} • ${userFullName}`} isCollapsed={isCollapsed} variant="light" className="w-full">
            <button
              onClick={toggleCollapsed}
              className={`flex items-center focus:outline-none cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] w-full group ${
                isCollapsed ? 'justify-center' : 'justify-start'
              }`}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <img
                  src={oakwoodIcon}
                  alt="Oakwood Emblem"
                  className="h-11 w-11 shrink-0 object-contain transition-all duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex items-center w-full">
                  <img
                    src={oakwoodLogo}
                    alt="Oakwood Logo"
                    className="h-[68px] w-auto max-w-[215px] shrink-0 object-contain transition-all duration-300 group-hover:scale-105"
                  />
                </div>
              )}
            </button>
          </SidebarHoverLabel>
        </div>

        <div className={`flex-1 py-5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCollapsed ? 'overflow-visible px-2' : 'overflow-y-auto px-3.5'}`}>
          <div className="relative overflow-hidden h-6 mb-3">
            <p className={`absolute left-2 text-[11px] font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] origin-left ${
              isCollapsed ? 'opacity-0 scale-90 pointer-events-none translate-x-[-10px]' : 'opacity-100 scale-100 translate-x-0'
            }`}>
              Platform
            </p>
          </div>
          <ul className="space-y-1">
            <li>
              <SidebarHoverLabel label="Dashboard" isCollapsed={isCollapsed} variant="light">
                <NavLink to="/" end onClick={closeSidebar} className={navLinkClass(isCollapsed)}>
                  <span className="shrink-0 h-5 w-5 flex items-center justify-center">
                    <HomeIcon />
                  </span>
                  <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isCollapsed ? 'grid-cols-[0fr] opacity-0 ml-0' : 'grid-cols-[1fr] opacity-100 ml-3.5'
                  }`}>
                    <div className="overflow-hidden whitespace-nowrap">
                      Dashboard
                    </div>
                  </div>
                </NavLink>
              </SidebarHoverLabel>
            </li>
            <li>
              <SidebarHoverLabel label="Activity Logs" isCollapsed={isCollapsed} variant="light">
                <NavLink to="/reports" onClick={closeSidebar} className={navLinkClass(isCollapsed)}>
                  <span className="shrink-0 h-5 w-5 flex items-center justify-center">
                    <ChartBarIcon />
                  </span>
                  <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isCollapsed ? 'grid-cols-[0fr] opacity-0 ml-0' : 'grid-cols-[1fr] opacity-100 ml-3.5'
                  }`}>
                    <div className="overflow-hidden whitespace-nowrap">
                      Activity Logs
                    </div>
                  </div>
                </NavLink>
              </SidebarHoverLabel>
            </li>
            <li>
              <SidebarHoverLabel label="Notifications" isCollapsed={isCollapsed} variant="light">
                <NavLink to="/notifications" onClick={closeSidebar} className={navLinkClass(isCollapsed)}>
                  <span className="shrink-0 h-5 w-5 flex items-center justify-center relative">
                    <BellIcon />
                    <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      isCollapsed && unreadCount > 0 ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
                    }`}>
                      {unreadCount}
                    </span>
                  </span>
                  <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isCollapsed ? 'grid-cols-[0fr] opacity-0 ml-0' : 'grid-cols-[1fr] opacity-100 ml-3.5'
                  }`}>
                    <div className="overflow-hidden whitespace-nowrap flex items-center justify-between">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-xs ml-2">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </NavLink>
              </SidebarHoverLabel>
            </li>
            <li>
              <SidebarHoverLabel label="Staff Users" isCollapsed={isCollapsed} variant="light">
                <NavLink to="/guards" onClick={closeSidebar} className={navLinkClass(isCollapsed)}>
                  <span className="shrink-0 h-5 w-5 flex items-center justify-center">
                    <UsersIcon />
                  </span>
                  <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isCollapsed ? 'grid-cols-[0fr] opacity-0 ml-0' : 'grid-cols-[1fr] opacity-100 ml-3.5'
                  }`}>
                    <div className="overflow-hidden whitespace-nowrap">
                      Staff Users
                    </div>
                  </div>
                </NavLink>
              </SidebarHoverLabel>
            </li>
          </ul>
        </div>
        
        <div className={`border-t border-emerald-500/15 dark:border-emerald-500/20 p-2.5 transition-all duration-300 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <ThemeToggle variant={isCollapsed ? 'compact' : 'expanded'} />
        </div>

        <div className={`border-t border-emerald-500/15 dark:border-emerald-500/20 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCollapsed ? 'p-2 flex justify-center' : 'p-3.5'}`}>
          <SidebarHoverLabel label={userName} isCollapsed={isCollapsed} variant="light" className={isCollapsed ? 'flex justify-center' : 'w-full'}>
            <button 
              type="button"
              onClick={() => setProfileOpen(true)}
              className={`flex items-center transition-all duration-200 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 cursor-pointer w-full rounded-xl ${
                isCollapsed ? 'p-1 gap-0' : 'p-2 gap-3'
              }`}
              aria-label={isCollapsed ? userName : 'Click to view profile'}
            >
              {user.profile_picture && user.profile_picture.length > 0 ? (
                <img
                  src={resolveProfilePictureUrl(user.profile_picture) || user.profile_picture}
                  alt={userName}
                  className={`shrink-0 rounded-xl object-cover shadow-xs transition-all duration-300 ${
                    isCollapsed ? 'h-10 w-10' : 'h-10 w-10'
                  }`}
                />
              ) : (
                <div className={`flex shrink-0 items-center justify-center text-xs font-bold text-emerald-800 dark:text-emerald-300 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 transition-all duration-300 ${
                  isCollapsed ? 'h-10 w-10' : 'h-10 w-10'
                }`}>
                  {userInitials}
                </div>
              )}
              <div className={`flex flex-1 items-center justify-between min-w-0 transition-all duration-300 origin-left truncate ${
                isCollapsed ? 'w-0 opacity-0 scale-90 pointer-events-none' : 'w-auto opacity-100 scale-100'
              }`}>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13px] font-bold text-zinc-900 dark:text-white">{userName}</p>
                  <p className="truncate text-[11px] font-medium text-zinc-600 dark:text-zinc-300">{user.email || 'admin@pdp.com'}</p>
                </div>
                <div className="text-zinc-500 dark:text-zinc-400 ml-1.5">
                  <ChevronUpDownIcon />
                </div>
              </div>
            </button>
          </SidebarHoverLabel>
        </div>
      </aside>

      {/* Main content */}
      <main className={`min-h-screen bg-[#f8fbf9] dark:bg-[#050806] pt-14 lg:pt-0 transition-colors duration-300 ${isCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[260px]'}`}>
        <div key={location.pathname} className="flex h-full w-full flex-1 flex-col gap-6 p-4 lg:p-8 animate-fade-in-up">
          <Outlet />
        </div>
      </main>

      <AdminProfileModal 
        isOpen={profileOpen} 
        onClose={() => setProfileOpen(false)} 
        user={user} 
        onLogout={handleLogoutRequest} 
      />

      <SignOutConfirmModal
        isOpen={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  )
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AdminLogin />} />
    <Route element={<ProtectedLayout />}>
      <Route index element={<AdminPage />} />
      <Route path="guards/*" element={<GuardsPage />} />
      <Route path="reports/*" element={<ReportsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </ThemeProvider>
)

export default App
