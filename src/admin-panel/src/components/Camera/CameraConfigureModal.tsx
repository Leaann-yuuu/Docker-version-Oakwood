import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useModalAnimation } from "../../hooks/useModalAnimation";
import { adminAuthApi } from "../../services/adminApi";

export type CameraLocation = "entrance" | "exit";

interface CameraConfigureModalProps {
  isOpen: boolean;
  label: string;
  badge: "IN" | "OUT";
  location: CameraLocation;
  streamUrl?: string;
  onClose: () => void;
  onSave: (url: string) => Promise<void>;
}

export const CameraConfigureModal = ({
  isOpen,
  label,
  badge,
  location,
  streamUrl,
  onClose,
  onSave,
}: CameraConfigureModalProps) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);
  const defaultUrl =
    location === "exit"
      ? "rtsp://Capstonecameraexit:Capstonecameraexit@192.168.1.63:554/stream2"
      : "rtsp://Capstonecamera:Capstonecamera@192.168.86.38:554/stream1";

  const [streamUrlInput, setStreamUrlInput] = useState(streamUrl || "");
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStreamUrlInput(streamUrl || "");
  }, [streamUrl]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (connectionResult) {
      const timer = setTimeout(() => {
        setConnectionResult(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [connectionResult]);

  const handleSave = () => {
    const trimmed = streamUrlInput.trim();
    if (!trimmed) {
      setError("Stream URL is required.");
      return;
    }

    setSaving(true);
    setError("");
    onSave(trimmed)
      .catch(() => setError(`Failed to update ${label.toLowerCase()} stream URL.`))
      .finally(() => setSaving(false));
  };

  const handleTestConnection = async () => {
    const trimmed = streamUrlInput.trim();
    if (!trimmed) {
      setError("Stream URL is required.");
      return;
    }

    setTestingConnection(true);
    setConnectionResult(null);
    setError("");

    try {
      const res = await adminAuthApi.testConnection(trimmed);
      if (res.data.online) {
        setConnectionResult({
          success: true,
          message: "Connection Successful! The ESP32-CAM is online and reachable.",
        });
      } else {
        setConnectionResult({
          success: false,
          message: res.data.message || "Connection Failed. Camera is offline or unreachable.",
        });
      }
    } catch {
      setConnectionResult({
        success: false,
        message: "Connection Failed. Server error or network unreachable.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const badgeClass =
    badge === "IN" ? "bg-emerald-600 text-white" : "bg-orange-600 text-white";

  if (!shouldRender) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-configure-title"
    >
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-md ${isAnimatingOut ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"}`}
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#18181b] ${isAnimatingOut ? "animate-modal-panel-out" : "animate-modal-panel-in"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-white/5 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="camera-configure-title"
                className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
              >
                Configure {label}
              </h2>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}
              >
                {badge}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Set the ESP32-CAM MJPEG stream URL for the {location} gate camera.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white cursor-pointer"
            aria-label="Close configure modal"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              ESP32-CAM MJPEG Stream URL
            </label>
            <input
              type="text"
              value={streamUrlInput}
              onChange={(e) => {
                setStreamUrlInput(e.target.value);
                setError("");
              }}
              placeholder={defaultUrl}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-black/40 dark:text-zinc-100"
            />
            {error && <p className="mt-2 text-xs font-semibold text-rose-500 dark:text-rose-400">{error}</p>}
            {window.location.protocol === "https:" &&
              streamUrlInput.startsWith("http://") && (
                <p className="mt-2 text-[11px] font-medium text-amber-500 dark:text-amber-400">
                  Mixed content warning: browsers block insecure HTTP streams on HTTPS pages.
                </p>
              )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConnection || saving}
            className="rounded-lg border border-blue-500/30 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 disabled:opacity-60 cursor-pointer"
          >
            {testingConnection ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || testingConnection}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors shadow-sm shadow-emerald-700/25 cursor-pointer"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {connectionResult && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConnectionResult(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {connectionResult.success ? (
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900/30 text-emerald-400">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            ) : (
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/30 text-red-400">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            )}
            <h3 className="text-base font-bold text-zinc-100">
              {connectionResult.success
                ? "Connection Succeeded"
                : "Connection Failed"}
            </h3>
            <p className="mt-2 text-xs text-zinc-400">
              {connectionResult.message}
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default CameraConfigureModal;
