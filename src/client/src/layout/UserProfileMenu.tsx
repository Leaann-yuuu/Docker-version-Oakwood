import { useAuth } from "../contexts/AuthContext";
import SidebarHoverLabel from "../components/Sidebar/SidebarHoverLabel";

const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) ?? "";
    const last = lastName?.charAt(0) ?? "";
    return (first + last).toUpperCase() || "U";
};

const formatFullName = (
    firstName?: string,
    middleName?: string | null,
    lastName?: string,
    suffixName?: string | null,
) => {
    if (!lastName && !firstName) return "";
    let name = `${lastName ?? ""}, ${firstName ?? ""}`.trim();
    if (middleName) name += ` ${middleName.charAt(0)}.`;
    if (suffixName) name += ` ${suffixName}`;
    return name.replace(/^,\s*/, "").replace(/,\s*$/, "");
};

const resolveProfilePictureUrl = (path?: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
        return path;
    }
    const cleanPath = path.replace(/^\/+/, "").replace(/^public\//, "");
    if (cleanPath.startsWith("storage/")) {
        return `http://127.0.0.1:8080/${cleanPath}`;
    }
    return `http://127.0.0.1:8080/storage/${cleanPath}`;
};

type UserProfileMenuProps = {
    onViewProfile?: () => void;
    variant?: "sidebar" | "header";
    isCollapsed?: boolean;
};

const UserProfileMenu = ({ onViewProfile, variant = "sidebar", isCollapsed = false }: UserProfileMenuProps) => {
    const { user } = useAuth();

    const initials = getInitials(user?.user?.first_name, user?.user?.last_name);
    const fullName = formatFullName(
        user?.user?.first_name,
        user?.user?.middle_name,
        user?.user?.last_name,
        user?.user?.suffix_name,
    );
    const profilePicUrl = resolveProfilePictureUrl(user?.user?.profile_picture);

    if (variant === "sidebar") {
        return (
            <div className="relative hidden lg:block w-full">
                <SidebarHoverLabel label={fullName || "My Profile"} isCollapsed={isCollapsed} variant="light" className={isCollapsed ? "w-full flex justify-center" : "w-full"}>
                    <button
                        type="button"
                        onClick={onViewProfile}
                        className={`flex items-center transition-all duration-300 ease-in-out hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 cursor-pointer w-full rounded-xl border border-transparent hover:border-emerald-500/20 dark:hover:border-emerald-500/30 ${
                            isCollapsed ? "p-1 gap-0" : "p-2 gap-3"
                        }`}
                        title="Click to view profile"
                        aria-label={fullName || "My Profile"}
                    >
                        <span className={`flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white overflow-hidden transition-all duration-300 ease-in-out shadow-xs ${
                            isCollapsed ? "h-10 w-10" : "h-9 w-9"
                        }`}>
                            {profilePicUrl ? (
                                <img src={profilePicUrl} alt={fullName || "User"} className="h-full w-full object-cover" />
                            ) : (
                                initials
                            )}
                        </span>
                        <div className={`flex flex-1 items-center justify-between min-w-0 transition-all duration-300 ease-in-out origin-left truncate ${
                            isCollapsed ? "w-0 opacity-0 scale-90 pointer-events-none" : "w-auto opacity-100 scale-100"
                        }`}>
                            <span className="grid min-w-0 flex-1 text-sm leading-tight text-left">
                                <span className="truncate font-bold text-zinc-900 dark:text-white">{fullName || "User"}</span>
                                <span className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">{user?.user?.email ?? user?.user?.username}</span>
                            </span>
                            <svg className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                        </div>
                    </button>
                </SidebarHoverLabel>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onViewProfile}
            className="flex rounded-full ring-2 ring-emerald-500/40 transition hover:ring-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 cursor-pointer"
            title="Click to view profile"
        >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white overflow-hidden shadow-xs">
                {profilePicUrl ? (
                    <img src={profilePicUrl} alt={fullName || "User"} className="h-full w-full object-cover" />
                ) : (
                    initials
                )}
            </span>
        </button>
    );
};

export default UserProfileMenu;
