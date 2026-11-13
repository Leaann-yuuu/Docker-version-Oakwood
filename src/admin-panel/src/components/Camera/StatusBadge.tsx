export type CameraHealthStatus = "online" | "offline";

interface StatusBadgeProps {
  status: CameraHealthStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const isOnline = status === "online";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
        isOnline
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]"}`}
        aria-hidden
      />
      {status}
    </span>
  );
};

export default StatusBadge;
