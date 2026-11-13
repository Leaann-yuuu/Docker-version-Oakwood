import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  variant?: "compact" | "expanded";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  variant = "compact",
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (variant === "expanded") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`group relative flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
          isDark
            ? "bg-black/90 hover:bg-zinc-950 border-emerald-500/40 hover:border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]"
            : "bg-white/95 hover:bg-emerald-50/40 border-emerald-500/25 hover:border-emerald-500 text-zinc-900 shadow-sm"
        } ${className}`}
        aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        title={isDark ? "Active: Dark Mode • Click to switch" : "Active: Light Mode • Click to switch"}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-300 ${
              isDark
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 rotate-0 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200/80 -rotate-12"
            }`}
          >
            {isDark ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </span>
          <span className="text-xs font-bold tracking-tight">
            {isDark ? "Dark Mode" : "Light Mode"}
          </span>
        </div>

        {/* Switch Pill */}
        <div
          className={`relative h-6 w-11 rounded-full p-0.5 transition-colors duration-300 ${
            isDark ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-emerald-600"
          }`}
        >
          <div
            className={`h-5 w-5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${
              isDark
                ? "translate-x-5 bg-black border border-emerald-400 text-emerald-400"
                : "translate-x-0 bg-white text-emerald-700"
            }`}
          >
            <span className="text-[10px] leading-none">
              {isDark ? "🌙" : "☀️"}
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 cursor-pointer focus:outline-none ${
        isDark
          ? "bg-black hover:bg-zinc-900 border-emerald-500/50 text-emerald-400 hover:border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          : "bg-white hover:bg-emerald-50/80 border-emerald-500/30 text-emerald-800 hover:border-emerald-500 shadow-sm"
      } ${className}`}
      title={isDark ? "Current: Dark Mode • Click to switch to Light Mode" : "Current: Light Mode • Click to switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <span className="transition-transform duration-300 transform group-hover:scale-110">
        {isDark ? (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )}
      </span>
      {/* Tiny active accent dot */}
      <span
        className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
          isDark ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]" : "bg-emerald-600"
        }`}
      />
    </button>
  );
};

export default ThemeToggle;
