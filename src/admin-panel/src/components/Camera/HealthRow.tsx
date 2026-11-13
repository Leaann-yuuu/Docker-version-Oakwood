interface HealthRowProps {
  label: string;
  status: string;
  indicator?: "success" | "danger" | "neutral";
}

export const HealthRow = ({
  label,
  status,
  indicator = "neutral",
}: HealthRowProps) => {
  const dotClass =
    indicator === "success"
      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
      : indicator === "danger"
        ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]"
        : "bg-zinc-400";

  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-zinc-500 font-medium">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-semibold capitalize text-zinc-800">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
        {status}
      </span>
    </div>
  );
};

export default HealthRow;
