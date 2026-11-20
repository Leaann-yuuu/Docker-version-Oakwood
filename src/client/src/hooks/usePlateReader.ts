import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CheckPlateResponse, VerifyPlateResponse } from "../interfaces/GateInterface";
import { formatPlateDisplay, normalizePlate } from "../utils/plateOcr";

const POLL_INTERVAL_MS = 1500;

export type PlateReaderStatus = "idle" | "scanning" | "detected" | "verifying" | "verified" | "error";

type UsePlateReaderOptions = {
    direction: "IN" | "OUT";
    cameraLocation: "entrance" | "exit";
    streamUrl: string;
    streamOnline: boolean;
    imageRef: RefObject<HTMLImageElement | null>;
    onVerified?: (result: VerifyPlateResponse) => void;
};

type LprDetectionItem = {
    plate: string | null;
    raw_text?: string | null;
    confidence?: number;
    box?: number[] | null;
    timestamp?: number;
    authorized?: boolean | null;
    resident?: string | null;
    car?: string | null;
    logged_at?: string | null;
};

type LprDetectionsPayload = {
    gate_state?: string;
    IN?: LprDetectionItem | null;
    OUT?: LprDetectionItem | null;
};

/**
 * Lightweight plate reader hook that reads real-time detections directly from
 * the Python LPR service (`http://localhost:5000/detections`) instead of running
 * heavy browser-side Tesseract OCR.
 */
export function usePlateReader({
    direction,
    streamUrl,
    streamOnline,
    onVerified,
}: UsePlateReaderOptions) {
    const [status, setStatus] = useState<PlateReaderStatus>("idle");
    const [detectedPlate, setDetectedPlate] = useState("");
    const [lastResult, setLastResult] = useState<VerifyPlateResponse | null>(null);
    const [checkResult, setCheckResult] = useState<CheckPlateResponse | null>(null);

    const pollingRef = useRef(false);
    const lastNotifiedKeyRef = useRef<string>("");

    const pollDetections = useCallback(async () => {
        if (pollingRef.current) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

        pollingRef.current = true;
        try {
            const host =
                typeof window !== "undefined" && window.location.hostname
                    ? window.location.hostname
                    : "127.0.0.1";
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 1200);

            const res = await fetch(`http://${host}:5000/detections`, {
                signal: controller.signal,
                cache: "no-store",
            });
            window.clearTimeout(timeoutId);

            if (!res.ok) {
                return;
            }

            const payload = (await res.json()) as LprDetectionsPayload;
            const det = direction === "OUT" ? payload.OUT : payload.IN;

            if (!det || !det.plate) {
                setDetectedPlate("");
                setCheckResult(null);
                setLastResult(null);
                setStatus("idle");
                return;
            }

            const normalized = normalizePlate(det.plate);
            const displayPlate = formatPlateDisplay(normalized);
            const isRegistered = det.authorized === true;
            const isPending = det.authorized === null || det.authorized === undefined;

            const carParts = (det.car ?? "").trim().split(/\s+/);
            const carModel = carParts.length > 1 ? carParts.slice(0, -1).join(" ") : det.car || null;
            const carColor = carParts.length > 1 ? carParts[carParts.length - 1] : null;

            setDetectedPlate(displayPlate);
            setCheckResult({
                registered: isRegistered,
                plate_number: normalized,
                resident_name: det.resident ?? null,
                car_model: carModel,
                car_color: carColor,
            });

            const synthResult: VerifyPlateResponse = {
                authorized: isRegistered,
                gate_status: payload.gate_state === "open" ? "open" : (payload.gate_state === "closed" ? "closed" : (isRegistered ? "open" : "closed")),
                direction,
                gate_action: isRegistered ? "ACCESS_GRANTED" : "ACCESS_DENIED",
                gate_command: isRegistered ? "OPEN_BARRIER" : "HOLD_BARRIER",
                resident_username: undefined,
                resident_name: det.resident ?? undefined,
                log: {
                    gate_log_id: 0,
                    user_id: undefined,
                    plate_number: normalized,
                    owner_name: det.resident ?? undefined,
                    car_model: carModel ?? undefined,
                    car_color: carColor ?? undefined,
                    direction,
                    status: isRegistered ? "authorized" : "unauthorized",
                    capture_image: undefined,
                    logged_at: det.logged_at ?? new Date().toISOString(),
                },
            };

            setLastResult(synthResult);
            setStatus(isPending ? "verifying" : isRegistered ? "verified" : "detected");

            const notifyKey = `${normalized}_${det.logged_at ?? ""}_${String(det.authorized)}`;
            if (!isPending && notifyKey !== lastNotifiedKeyRef.current) {
                lastNotifiedKeyRef.current = notifyKey;
                onVerified?.(synthResult);
            }
        } catch {
            // Silently ignore if Python LPR server on :5000 is not reachable; DashboardPage already receives activePlate from Laravel
        } finally {
            pollingRef.current = false;
        }
    }, [direction, onVerified]);

    useEffect(() => {
        if (!streamOnline || !streamUrl) {
            setStatus("idle");
            setDetectedPlate("");
            setCheckResult(null);
            setLastResult(null);
            return;
        }

        void pollDetections();

        const intervalId = window.setInterval(() => {
            void pollDetections();
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [pollDetections, streamOnline, streamUrl]);

    return {
        status,
        detectedPlate,
        lastResult,
        checkResult,
    };
}

