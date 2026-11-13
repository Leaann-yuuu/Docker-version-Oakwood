import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { SidebarProvider, useSidebar } from "../contexts/SidebarContext";
import AppLogo from "./AppLogo";
import UserProfileMenu from "./UserProfileMenu";
import type { NavItem } from "./navConfig";
import { useAuth } from "../contexts/AuthContext";
import UserProfileModal from "../components/Profile/UserProfileModal";
import SignOutConfirmModal from "../components/Auth/SignOutConfirmModal";
import SidebarHoverLabel from "../components/Sidebar/SidebarHoverLabel";
import oakwoodLogo from "../assets/img/oakwood-logo.png";
import oakwoodIcon from "../assets/img/oakwood-icon.png";
import ThemeToggle from "../components/UI/ThemeToggle";
import { usePersistedSidebarCollapsed } from "../hooks/usePersistedSidebarCollapsed";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "gate-client-sidebar-collapsed";

type PortalLayoutProps = {
    navItems: NavItem[];
    homePath: string;
    portalLabel: string;
};

const PortalLayoutContent = ({ navItems, homePath, portalLabel }: PortalLayoutProps) => {
    const { isOpen, toggleSidebar } = useSidebar();
    const location = useLocation();
    const navigate = useNavigate();
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
    const { isCollapsed, toggleCollapsed } = usePersistedSidebarCollapsed(SIDEBAR_COLLAPSED_STORAGE_KEY);
    const { user, logout } = useAuth();
    const userRole = user?.user?.role;
    const roleTitle = (userRole as string) === 'guard' || (userRole as string) === 'security_guard'
        ? 'SECURITY GUARD'
        : userRole === 'resident'
        ? 'RESIDENT'
        : userRole === 'admin'
        ? 'SYSTEM ADMINISTRATOR'
        : (userRole || 'USER').toUpperCase();

    const userFullName = `${user?.user?.first_name || ''} ${user?.user?.last_name || ''}`.trim() || 'User';

    const closeSidebar = () => {
        if (isOpen && window.innerWidth < 1024) toggleSidebar();
    };

    const isActive = (path: string) =>
        location.pathname === path || location.pathname.startsWith(`${path}/`);

    const handleLogoutRequest = () => {
        setProfileModalOpen(false);
        setSignOutConfirmOpen(true);
    };

    const handleLogoutConfirm = async () => {
        try {
            await logout();
            setSignOutConfirmOpen(false);
            navigate("/");
        } catch (error) {
            console.error("Unexpected server error during logout:", error);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fbf9] dark:bg-[#050806] text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            {/* Mobile header */}
            <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-emerald-500/15 dark:border-emerald-500/20 bg-white/95 dark:bg-[#0a0e0c]/95 backdrop-blur-xl px-4 lg:hidden shadow-xs">
                <button
                    type="button"
                    onClick={toggleSidebar}
                    className="rounded-xl p-2 text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                    aria-label="Open sidebar"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" d="M5 7h14M5 12h14M5 17h10" />
                    </svg>
                </button>
                <AppLogo homePath={homePath} />
                <div className="flex items-center gap-2">
                    <ThemeToggle variant="compact" />
                    <UserProfileMenu
                        variant="header"
                        onViewProfile={() => setProfileModalOpen(true)}
                    />
                </div>
            </header>

            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
                    onClick={toggleSidebar}
                    aria-hidden
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-40 flex h-screen flex-col border-e border-emerald-500/15 dark:border-emerald-500/20 bg-white/95 dark:bg-[#0a0e0c]/95 backdrop-blur-xl shadow-[4px_0_24px_rgba(16,185,129,0.05)] dark:shadow-[4px_0_30px_rgba(0,0,0,0.8)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isOpen ? "translate-x-0" : "-translate-x-full"
                } lg:translate-x-0 ${isCollapsed ? "w-[76px]" : "w-[260px]"}`}
                aria-label="Sidebar"
            >
                <div className="hidden border-b border-emerald-500/15 dark:border-emerald-500/20 px-3.5 py-2 lg:flex items-center justify-start h-[88px] shrink-0">
                    <SidebarHoverLabel label={`${roleTitle} • ${userFullName}`} isCollapsed={isCollapsed} variant="light" className="w-full">
                        <button
                            onClick={toggleCollapsed}
                            className={`flex items-center focus:outline-none cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] w-full group ${
                                isCollapsed ? "justify-center" : "justify-start"
                            }`}
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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

                <div className={`flex-1 py-6 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCollapsed ? "overflow-visible px-2" : "overflow-y-auto px-4"}`}>
                    <div className="relative overflow-hidden h-6 mb-4">
                        <p className={`absolute left-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] origin-left ${
                            isCollapsed ? "opacity-0 scale-90 pointer-events-none translate-x-[-10px]" : "opacity-100 scale-100 translate-x-0"
                        }`}>
                            {portalLabel}
                        </p>
                    </div>
                    <ul className="space-y-1.5">
                        {navItems.map((item) => (
                            <li key={item.path}>
                                <SidebarHoverLabel label={item.label} isCollapsed={isCollapsed} variant="light">
                                    <Link
                                        to={item.path}
                                        onClick={closeSidebar}
                                        className={`flex items-center rounded-xl text-[14px] font-semibold transition-all duration-200 px-3.5 py-2.5 ${
                                            isActive(item.path)
                                                ? "bg-emerald-600 dark:bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 font-bold"
                                                : "text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium"
                                        }`}
                                    >
                                        <span className="shrink-0 h-5 w-5 flex items-center justify-center relative">
                                            {item.icon}
                                            {item.badgeCount != null && item.badgeCount > 0 && (
                                                <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                                                    isCollapsed ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
                                                }`}>
                                                    {item.badgeCount}
                                                </span>
                                            )}
                                        </span>
                                        <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                                            isCollapsed ? "grid-cols-[0fr] opacity-0 ml-0" : "grid-cols-[1fr] opacity-100 ml-3.5"
                                        }`}>
                                            <div className="overflow-hidden whitespace-nowrap flex items-center justify-between">
                                                <span>{item.label}</span>
                                                {item.badgeCount != null && item.badgeCount > 0 && (
                                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-xs ml-2">
                                                        {item.badgeCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </SidebarHoverLabel>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={`border-t border-emerald-500/15 dark:border-emerald-500/20 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCollapsed ? "overflow-visible p-2 flex flex-col items-center gap-2" : "p-4 space-y-3"}`}>
                    <UserProfileMenu
                        variant="sidebar"
                        isCollapsed={isCollapsed}
                        onViewProfile={() => setProfileModalOpen(true)}
                    />
                    <div className="w-full">
                        <ThemeToggle variant={isCollapsed ? "compact" : "expanded"} />
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className={`min-h-screen bg-[#f8fbf9] dark:bg-[#050806] pt-14 lg:pt-0 transition-all duration-300 ${isCollapsed ? "lg:ml-[76px]" : "lg:ml-[260px]"}`}>
                <div key={location.pathname} className="flex h-full w-full flex-1 flex-col gap-4 p-4 lg:p-8 text-zinc-900 dark:text-zinc-100 animate-fade-in-up">
                    <Outlet />
                </div>
            </main>


            {user && (
                <UserProfileModal
                    isOpen={profileModalOpen}
                    onClose={() => setProfileModalOpen(false)}
                    user={user.user}
                    onLogout={handleLogoutRequest}
                />
            )}

            <SignOutConfirmModal
                isOpen={signOutConfirmOpen}
                onClose={() => setSignOutConfirmOpen(false)}
                onConfirm={handleLogoutConfirm}
            />
        </div>
    );
};

const PortalLayout = (props: PortalLayoutProps) => (
    <SidebarProvider>
        <PortalLayoutContent {...props} />
    </SidebarProvider>
);

export default PortalLayout;
