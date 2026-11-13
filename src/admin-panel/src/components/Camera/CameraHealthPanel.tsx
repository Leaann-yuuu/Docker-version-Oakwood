import StatusBadge, { type CameraHealthStatus } from "./StatusBadge";
import HealthRow from "./HealthRow";

interface CameraHealthPanelProps {
  label: string;
  status: CameraHealthStatus;
  hasStreamUrl: boolean;
}

export const CameraHealthPanel = ({
  label,
  status,
  hasStreamUrl,
}: CameraHealthPanelProps) => {
  const isOnline = status === "online";

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/75 backdrop-blur-md p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          {label} — System Health
        </h4>
        <StatusBadge status={status} />
      </div>
      <div className="space-y-2.5">
        <HealthRow
          label="Camera Status"
          status={status}
          indicator={isOnline ? "success" : "danger"}
        />
        <HealthRow
          label="Stream Connection"
          status={
            hasStreamUrl
              ? isOnline
                ? "connected"
                : "disconnected"
              : "not configured"
          }
          indicator={
            hasStreamUrl ? (isOnline ? "success" : "danger") : "neutral"
          }
        />
      </div>
    </div>
  );
};

export default CameraHealthPanel;
