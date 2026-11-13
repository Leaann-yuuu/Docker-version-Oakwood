import { useEffect, useRef, useState } from "react";
import CameraHealthPanel from "./CameraHealthPanel";
import CameraConfigureModal, { type CameraLocation } from "./CameraConfigureModal";
import CameraBigScreenModal from "./CameraBigScreenModal";
import type { CameraHealthStatus } from "./StatusBadge";
import AnprPlateOverlay from "./AnprPlateOverlay";
import type { ActivePlateInfo } from "../../services/adminApi";

interface CameraFeedPanelProps {
  location: CameraLocation;
  label: string;
  badge: "IN" | "OUT";
  streamUrl?: string;
  directStreamUrl?: string;
  cameraStatus: CameraHealthStatus | string;
  onSaveStreamUrl: (url: string) => Promise<void>;
  onStatusChange: (status: CameraHealthStatus) => void;
  activePlate?: ActivePlateInfo | null;
}

export const CameraFeedPanel = ({
  location,
  label,
  badge,
  streamUrl,
  directStreamUrl,
  cameraStatus,
  onSaveStreamUrl,
  onStatusChange,
  activePlate,
}: CameraFeedPanelProps) => {
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [showBigScreenModal, setShowBigScreenModal] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [liveStatus, setLiveStatus] = useState<CameraHealthStatus>(
    cameraStatus === "online" ? "online" : "offline"
  );
  const [retryCount, setRetryCount] = useState(0);
  const [displaySrc, setDisplaySrc] = useState<string>("");
  const isFetchingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const lastReportedStatus = useRef<CameraHealthStatus | null>(null);
  const streamImageRef = useRef<HTMLImageElement | null>(null);

  const isMjpegStream = Boolean(
    streamUrl && (streamUrl.includes("/stream") || streamUrl.includes("proxy"))
  );

  useEffect(() => {
    if (cameraStatus === "online") {
      setLiveStatus("online");
      setStreamError(false);
    }
  }, [cameraStatus]);

  // Set direct stream URL for MJPEG or initial snapshot
  useEffect(() => {
    setStreamError(false);
    consecutiveErrorsRef.current = 0;
    if (!streamUrl) {
      setDisplaySrc("");
      return;
    }

    const delimiter = streamUrl.includes("?") ? "&" : "?";
    setDisplaySrc(`${streamUrl}${delimiter}_t=${Date.now()}`);
  }, [streamUrl, retryCount]);

  // Auto-reconnect timer if an error occurs
  useEffect(() => {
    if (!streamError) return;
    const timer = setTimeout(() => {
      setRetryCount((prev) => prev + 1);
      setStreamError(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [streamError]);

  // Polling loop ONLY if NOT an MJPEG continuous stream
  useEffect(() => {
    if (!streamUrl || isMjpegStream || streamError) return;

    let isMounted = true;
    let fetchTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const intervalMs = 66; // 15 FPS

    const intervalId = setInterval(() => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      fetchTimeoutId = setTimeout(() => {
        if (isFetchingRef.current) isFetchingRef.current = false;
      }, 750);

      const delimiter = streamUrl.includes("?") ? "&" : "?";
      const targetUrl = `${streamUrl}${delimiter}_t=${Date.now()}`;

      const preloader = new Image();
      preloader.onload = () => {
        if (fetchTimeoutId) clearTimeout(fetchTimeoutId);
        if (!isMounted) return;
        setDisplaySrc(targetUrl);
        handleStreamLoad();
        isFetchingRef.current = false;
      };
      preloader.onerror = () => {
        if (fetchTimeoutId) clearTimeout(fetchTimeoutId);
        if (!isMounted) return;
        handleStreamError();
        isFetchingRef.current = false;
      };
      preloader.src = targetUrl;
    }, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (fetchTimeoutId) clearTimeout(fetchTimeoutId);
    };
  }, [streamUrl, isMjpegStream, streamError]);

  const reportStatus = (status: CameraHealthStatus) => {
    setLiveStatus(status);
    if (lastReportedStatus.current !== status) {
      lastReportedStatus.current = status;
      onStatusChange(status);
    }
  };

  const handleStreamLoad = () => {
    consecutiveErrorsRef.current = 0;
    setStreamError(false);
    reportStatus("online");
  };

  const handleStreamError = () => {
    consecutiveErrorsRef.current += 1;
    if (consecutiveErrorsRef.current >= 3 || isMjpegStream) {
      setStreamError(true);
      reportStatus("offline");
    }
  };

  const handleRetryStream = () => {
    consecutiveErrorsRef.current = 0;
    setStreamError(false);
    setRetryCount((prev) => prev + 1);
  };

  const badgeClass =
    badge === "IN"
      ? "bg-emerald-600/90 text-white"
      : "bg-orange-600/90 text-white";

  const effectiveStatus = streamUrl && !streamError ? liveStatus : "offline";

  return (
    <div className="flex flex-col gap-3 max-w-2xl w-full">
      <div className="rounded-2xl border border-white/80 bg-white/85 backdrop-blur-xl p-4 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04),0_2px_6px_-1px_rgba(0,0,0,0.02)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{label}</h3>
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>
              {badge}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBigScreenModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-all shadow-2xs cursor-pointer group"
              title={`View ${label} in full view`}
            >
              <svg
                className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-800 dark:text-zinc-400 dark:group-hover:text-white transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              <span>Full View</span>
            </button>
            <button
              type="button"
              onClick={() => setShowConfigureModal(true)}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer px-1 py-1"
            >
              Configure
            </button>
          </div>
        </div>

        <div className="relative flex aspect-video max-h-[380px] w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-950 border border-zinc-900/40 shadow-inner">
          {streamUrl && !streamError && displaySrc ? (
            <img
              ref={streamImageRef}
              src={displaySrc}
              alt={label}
              onLoad={handleStreamLoad}
              onError={handleStreamError}
              className="h-full w-full object-cover select-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-4 text-center text-zinc-400">
              <svg
                className="h-10 w-10 text-zinc-600"
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
              <p className="mt-2 text-sm font-semibold text-zinc-300">
                Stream Offline or Failed
              </p>
              <p className="mt-1 max-w-xs text-[11px] text-zinc-500 font-mono">
                Could not connect to {directStreamUrl || "no URL configured"}.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleRetryStream}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfigureModal(true)}
                  className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/20 transition"
                >
                  Configure
                </button>
              </div>
            </div>
          )}

          {/* 15 FPS LIVE badge overlay */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/10 shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-emerald-400 tracking-wider">15 FPS LIVE</span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-300">ANPR AI</span>
          </div>

          {/* Location and Active Plate badge overlay */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2">
            <p className="rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md border border-white/10">
              {badge} | {effectiveStatus}
            </p>
            {activePlate?.plate_number && (
              <p className="rounded-lg bg-emerald-950/85 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 backdrop-blur-md border border-emerald-500/30 flex items-center gap-1.5 shadow-md">
                <span className="text-emerald-300">PLATE:</span>
                <span className="font-mono tracking-wider text-white font-bold">{activePlate.plate_number}</span>
                <span className="text-[9px] uppercase px-1 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                  {activePlate.authorized ? "Authorized" : "Denied"}
                </span>
              </p>
            )}
          </div>

          {/* ANPR Overlay */}
          {effectiveStatus === "online" && (
            <AnprPlateOverlay
              activePlate={activePlate}
              streamOnline={effectiveStatus === "online"}
            />
          )}
        </div>
      </div>

      <CameraHealthPanel
        label={label}
        status={effectiveStatus}
        hasStreamUrl={Boolean(streamUrl)}
      />

      <CameraConfigureModal
        isOpen={showConfigureModal}
        label={label}
        badge={badge}
        location={location}
        streamUrl={directStreamUrl}
        onClose={() => setShowConfigureModal(false)}
        onSave={(url) =>
          onSaveStreamUrl(url).then(() => {
            setShowConfigureModal(false);
            setStreamError(false);
            lastReportedStatus.current = null;
            if (url) {
              const delimiter = url.includes("?") ? "&" : "?";
              setDisplaySrc(`${url}${delimiter}_t=${Date.now()}`);
            }
            reportStatus("online");
          })
        }
      />

      <CameraBigScreenModal
        isOpen={showBigScreenModal}
        onClose={() => setShowBigScreenModal(false)}
        label={label}
        badge={badge}
        location={location}
        streamUrl={streamUrl}
        directStreamUrl={directStreamUrl}
        cameraStatus={effectiveStatus}
        displaySrc={displaySrc}
        activePlate={activePlate}
        onRetry={handleRetryStream}
        onOpenConfigure={() => {
          setShowBigScreenModal(false);
          setShowConfigureModal(true);
        }}
        onStreamLoad={handleStreamLoad}
        onStreamError={handleStreamError}
      />
    </div>
  );
};

export default CameraFeedPanel;
