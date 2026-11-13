import { formatPlateDisplay } from "../../utils/plateFormat";
import type { ActivePlateInfo } from "../../services/adminApi";

interface AnprPlateOverlayProps {
  activePlate?: ActivePlateInfo | null;
  streamOnline: boolean;
}

/**
 * =========================================================================
 * ANPR LICENSE PLATE SCANNER BOX DIMENSIONS
 * =========================================================================
 * Adjust these percentage (%) values anytime to change the size or position
 * of the scanning reticle overlay on the camera feed:
 *
 *  - left:   Horizontal distance from left edge (0% - 100%)
 *  - top:    Vertical distance from top edge (0% - 100%)
 *  - width:  Width of the scanner frame (0% - 100%)
 *  - height: Height of the scanner frame (0% - 100%)
 * =========================================================================
 */
export const PLATE_BOX = { left: 8, top: 38, width: 84, height: 40 };
const ACCENT_GREEN = "#00ff41";
const ACCENT_RED = "#ef4444";
const ACCENT_YELLOW = "#eab308";
const ACCENT_IDLE = "rgba(234, 179, 8, 0.75)";

export const AnprPlateOverlay = ({
  activePlate,
  streamOnline,
}: AnprPlateOverlayProps) => {
  if (!streamOnline) return null;

  const plate = activePlate?.plate_number
    ? formatPlateDisplay(activePlate.plate_number)
    : "";

  const registered = activePlate ? activePlate.authorized : undefined;
  const isScanning = !plate || activePlate?.status === "scanning" || activePlate?.status === "verifying";

  const accent =
    registered === false
      ? ACCENT_RED
      : registered === true
        ? ACCENT_GREEN
        : isScanning
          ? ACCENT_YELLOW
          : ACCENT_IDLE;

  const model = activePlate?.car_model || "—";
  const color = activePlate?.car_color || "—";
  const owner = activePlate?.resident_name || "—";

  const statusLabel = isScanning && !plate
    ? "Scanning..."
    : plate
      ? registered
        ? "Registered"
        : "Not Registered"
      : "Idle";

  const boxRight = PLATE_BOX.left + PLATE_BOX.width;
  const boxCenterY = PLATE_BOX.top + PLATE_BOX.height / 2;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Target Reticle Box */}
      <div
        className="absolute border-2 transition-colors duration-300"
        style={{
          left: `${PLATE_BOX.left}%`,
          top: `${PLATE_BOX.top}%`,
          width: `${PLATE_BOX.width}%`,
          height: `${PLATE_BOX.height}%`,
          borderColor: accent,
          boxShadow:
            registered !== undefined
              ? registered
                ? "0 0 10px rgba(0,255,65,0.6)"
                : "0 0 10px rgba(239,68,68,0.6)"
              : "0 0 8px rgba(234,179,8,0.5)",
          animation: isScanning && !plate ? "anpr-pulse 1.8s ease-in-out infinite" : undefined,
        }}
      >
        {/* Laser scan line effect */}
        {isScanning && !plate && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-yellow-400 shadow-[0_0_8px_#eab308]"
            style={{
              animation: "scan-laser 2.2s linear infinite",
            }}
          />
        )}
      </div>

      {/* Target Reticle Corner Brackets */}
      <PlateCornerBrackets accent={accent} />

      {/* Detected Plate Callout Info Panel */}
      {plate && (
        <>
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <line
              x1={`${boxRight}%`}
              y1={`${boxCenterY}%`}
              x2="72%"
              y2="32%"
              stroke={accent}
              strokeWidth="2"
            />
          </svg>

          <div
            className="absolute right-[4%] top-[16%] min-w-[150px] max-w-[55%] border-2 bg-black/92 px-3.5 py-2.5 font-mono text-[11px] leading-relaxed shadow-xl backdrop-blur-md rounded-md sm:text-xs"
            style={{ borderColor: accent, color: accent }}
          >
            <p className="font-bold tracking-wide">
              {plate}
              <span className="font-normal opacity-80"> (PH)</span>
            </p>
            <p className="mt-1 opacity-90">
              Model: <span className="text-white">{model}</span>
            </p>
            <p className="opacity-90">
              Color: <span className="text-white">{color}</span>
            </p>
            {owner !== "—" && (
              <p className="opacity-90">
                Owner: <span className="text-white">{owner}</span>
              </p>
            )}
            <p className="mt-1.5 font-bold uppercase tracking-wider">
              Status:{" "}
              <span
                className={
                  registered === true
                    ? "text-[#00ff41]"
                    : registered === false
                      ? "text-red-400"
                      : "text-yellow-300"
                }
              >
                {statusLabel}
              </span>
            </p>
          </div>
        </>
      )}

      <style>{`
        @keyframes anpr-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes scan-laser {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

const PlateCornerBrackets = ({ accent }: { accent: string }) => {
  const { left, top, width, height } = PLATE_BOX;
  const right = left + width;
  const bottom = top + height;
  const size = 2.5;

  const corners = [
    { x: left, y: top, dx: size, dy: 0, dx2: 0, dy2: size },
    { x: right, y: top, dx: -size, dy: 0, dx2: 0, dy2: size },
    { x: left, y: bottom, dx: size, dy: 0, dx2: 0, dy2: -size },
    { x: right, y: bottom, dx: -size, dy: 0, dx2: 0, dy2: -size },
  ];

  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden>
      {corners.map((c, i) => (
        <g key={i} stroke={accent} strokeWidth="3" fill="none">
          <line
            x1={`${c.x}%`}
            y1={`${c.y}%`}
            x2={`${c.x + c.dx}%`}
            y2={`${c.y + c.dy}%`}
          />
          <line
            x1={`${c.x}%`}
            y1={`${c.y}%`}
            x2={`${c.x + c.dx2}%`}
            y2={`${c.y + c.dy2}%`}
          />
        </g>
      ))}
    </svg>
  );
};

export default AnprPlateOverlay;
