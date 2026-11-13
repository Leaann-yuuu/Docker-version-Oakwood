import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import type { CameraHealthStatus } from "./StatusBadge";
import type { CameraLocation } from "./CameraConfigureModal";
import type { ActivePlateInfo } from "../../services/adminApi";
import AnprPlateOverlay from "./AnprPlateOverlay";

interface CameraBigScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  badge: "IN" | "OUT";
  location: CameraLocation;
  streamUrl?: string;
  directStreamUrl?: string;
  cameraStatus: CameraHealthStatus | string;
  displaySrc: string;
  activePlate?: ActivePlateInfo | null;
  onRetry: () => void;
  onOpenConfigure: () => void;
  onStreamLoad?: () => void;
  onStreamError?: () => void;
}

export const CameraBigScreenModal = ({
  isOpen,
  onClose,
  label,
  badge,
  location,
  streamUrl,
  directStreamUrl,
  cameraStatus,
  displaySrc,
  activePlate,
  onRetry,
  onOpenConfigure,
  onStreamLoad,
  onStreamError,
}: CameraBigScreenModalProps) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
        " • " +
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for native fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Toggle native fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Ignored if user blocked fullscreen or not allowed
    }
  };

  // Keyboard navigation: Escape key closes modal (when not in native fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!document.fullscreenElement) {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const badgeClass =
    badge === "IN" ? "bg-emerald-600 text-white" : "bg-orange-600 text-white";

  const isOnline = cameraStatus === "online";

  if (!shouldRender) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-bigscreen-title"
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity ${isAnimatingOut ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
          }`}
        onClick={onClose}
      />

      {/* Main  Container */}
      <div
        ref={containerRef}
        className={`relative z-10 flex flex-col w-full max-w-7xl max-h-[96vh] rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl overflow-hidden transition-all duration-300 ${isFullscreen ? "h-screen max-h-screen rounded-none border-none p-0" : ""
          } ${isAnimatingOut ? "animate-modal-panel-out" : "animate-modal-panel-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md">
          {/* Left: Title, Badges & Live Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h2
                id="camera-bigscreen-title"
                className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2"
              >
                <span>{label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeClass}`}>
                  {badge}
                </span>
              </h2>
            </div>

            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-700/60 pl-3">
              <span className="relative flex h-2.5 w-2.5">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? "bg-emerald-500" : "bg-red-500"
                    }`}
                ></span>
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${isOnline ? "text-emerald-400" : "text-red-400"
                  }`}
              >
                {isOnline ? "Live Feed" : "Offline"}
              </span>
            </div>
          </div>

          {/* Right: Actions, Fullscreen & Close */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Clock */}
            <div className="hidden md:block text-xs font-mono text-zinc-400 bg-zinc-800/60 border border-zinc-700/50 px-3 py-1 rounded-lg">
              {currentTime}
            </div>

            {/* Configure Shortcut */}
            <button
              type="button"
              onClick={onOpenConfigure}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/70 transition-colors cursor-pointer"
              title="Camera Settings"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="hidden sm:inline">Configure</span>
            </button>

            {/* Native Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/70 transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 9L4 4m0 0v4m0-4h4m6 0h4m0 0v4m0-4l-5 5M9 15l-5 5m0 0v-4m0 4h4m11-4v4m0 0h-4m4 0l-5-5"
                    />
                  </svg>
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close Full View"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Video Screen Area */}
        <div
          className="relative flex-1 flex items-center justify-center bg-black overflow-hidden select-none min-h-[380px] sm:min-h-[480px] lg:min-h-[560px]"
          onDoubleClick={toggleFullscreen}
        >
          {isOnline && displaySrc ? (
            <>
              <img
                src={displaySrc}
                alt={label}
                onLoad={onStreamLoad}
                onError={onStreamError}
                className="w-full h-full object-contain max-h-[82vh] select-none"
              />

              {/* ANPR Scanner Overlay Reticle */}
              <AnprPlateOverlay activePlate={activePlate} streamOnline={isOnline} />

              {/* 15 FPS LIVE badge overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2 rounded-xl bg-black/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md border border-white/10 shadow-xl">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-emerald-400 tracking-wider">15 FPS LIVE</span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-300">ANPR AI</span>
              </div>

              {/* Bottom Info Bar Overlay */}
              <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
                <div className="rounded-xl bg-black/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-lg">
                  <span className="text-zinc-400 uppercase tracking-wider">{location}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-emerald-400 font-bold">{badge}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-300">ONLINE</span>
                </div>

                {activePlate?.plate_number && (
                  <div className="rounded-xl bg-black/85 px-3.5 py-1 text-xs font-bold backdrop-blur-md border border-emerald-500/30 flex items-center gap-2 shadow-lg">
                    <span className="text-emerald-400">PLATE:</span>
                    <span className="font-mono tracking-widest text-white text-sm">
                      {activePlate.plate_number}
                    </span>
                    <span
                      className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${activePlate.authorized
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-red-500/20 text-red-400 border border-red-500/40"
                        }`}
                    >
                      {activePlate.authorized ? "Authorized" : "Denied"}
                    </span>
                    {activePlate.resident_name && (
                      <span className="text-zinc-300 hidden sm:inline text-[11px] font-normal border-l border-zinc-700 pl-2">
                        {activePlate.resident_name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <div className="rounded-full bg-zinc-900/80 p-4 border border-zinc-800">
                <svg
                  className="h-12 w-12 text-zinc-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-zinc-200">Stream Offline or Failed</h3>
              <p className="mt-1 max-w-md text-xs text-zinc-500 font-mono">
                Could not connect to {directStreamUrl || "no stream URL configured"}.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-bold text-zinc-200 transition-colors shadow-sm cursor-pointer"
                >
                  Retry Connection
                </button>
                <button
                  type="button"
                  onClick={onOpenConfigure}
                  className="rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer"
                >
                  Configure Stream
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-t border-zinc-800/80 bg-zinc-900/90 text-[11px] text-zinc-400 font-mono">
          <div className="flex items-center gap-2 truncate max-w-xl">
            <span className="text-zinc-500">Source:</span>
            <span className="truncate text-zinc-300">
              {directStreamUrl || streamUrl || "No endpoint configured"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-zinc-500">
            <span>Double-click feed to toggle fullscreen</span>
            <span>•</span>
            <span>ESC to exit</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CameraBigScreenModal;

