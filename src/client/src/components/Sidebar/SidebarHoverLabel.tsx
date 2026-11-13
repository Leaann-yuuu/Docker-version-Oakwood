import type { ReactNode } from "react";

type SidebarHoverLabelProps = {
    label: string;
    isCollapsed: boolean;
    children: ReactNode;
    className?: string;
    variant?: "light" | "dark";
};

const SidebarHoverLabel = ({
    label,
    isCollapsed,
    children,
    className = "",
    variant = "light",
}: SidebarHoverLabelProps) => (
    <div className={`relative group ${className}`}>
        {children}
        {isCollapsed && (
            <span
                role="tooltip"
                className={`pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-[60] -translate-y-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 ${
                    variant === "dark"
                        ? "border border-emerald-500/40 bg-black text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                        : "border border-emerald-500/30 bg-white text-zinc-900 shadow-md dark:border-emerald-500/40 dark:bg-black dark:text-white dark:shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                }`}
            >
                {label}
            </span>
        )}
    </div>
);

export default SidebarHoverLabel;
