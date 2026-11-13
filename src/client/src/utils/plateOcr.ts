import GateAccessService from "../services/GateAccessService";

const PLATE_PATTERNS = [
    /\b[A-Z]{2,4}[-\s]?[0-9OILS]{3,5}\b/g,
    /\b[0-9OILS]{3,5}[-\s]?[A-Z]{2,4}\b/g,
    /\b[A-Z0-9]{4,10}\b/g,
];

export function normalizePlate(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatPlateInput(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function formatPlateDisplay(value: string): string {
    const normalized = normalizePlate(value);
    return normalized || value.toUpperCase();
}

/** Fix common OCR mistakes based on typical PH plate format (letters then digits) */
export function correctPlateOcr(raw: string): string[] {
    const normalized = normalizePlate(raw);
    if (normalized.length < 4) return [];

    const variants = new Set<string>([normalized]);

    const letterToDigit: Record<string, string> = { O: "0", I: "1", L: "1", S: "5", B: "8", Z: "2" };
    const digitToLetter: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z" };

    for (let split = 2; split <= 4; split++) {
        if (split >= normalized.length) continue;

        const letterPart = normalized.slice(0, split);
        const digitPart = normalized.slice(split);

        let fixedLetters = "";
        for (const ch of letterPart) {
            fixedLetters += digitToLetter[ch] ?? ch;
        }

        let fixedDigits = "";
        for (const ch of digitPart) {
            fixedDigits += letterToDigit[ch] ?? ch;
        }

        const candidate = fixedLetters + fixedDigits;
        if (/^[A-Z]{2,4}\d{3,5}$/.test(candidate)) {
            variants.add(candidate);
        }
    }

    return Array.from(variants);
}

const IGNORED_HUD_WORDS = new Set([
    "LIVE", "15FPS", "ENTRANCE", "EXIT", "CAMERA", "GATE", "STATE", "OPEN",
    "CLOSED", "ANPR", "FULL", "SCREEN", "SCAN", "PLATE", "CONF", "AUTHORIZED",
    "DENIED", "UNAUTHORIZED", "VERIFYING", "DATABASE", "REGISTERED", "UNKNOWN",
]);

function scorePlateCandidate(normalized: string): number {
    if (normalized.length < 4 || normalized.length > 10) return 0;
    if (IGNORED_HUD_WORDS.has(normalized)) return 0;

    const alphaNum = normalized.match(/[A-Z]/g)?.length ?? 0;
    const digits = normalized.match(/\d/g)?.length ?? 0;
    if (alphaNum < 2 || digits < 2) return 0;

    const lettersDigits = normalized.match(/^([A-Z]{2,4})(\d{3,5})$/);
    if (lettersDigits) return 100 + lettersDigits[1].length + lettersDigits[2].length;

    const digitsLetters = normalized.match(/^(\d{3,5})([A-Z]{2,4})$/);
    if (digitsLetters) return 80 + digitsLetters[1].length + digitsLetters[2].length;

    if (alphaNum >= 2 && digits >= 3) return 50 + alphaNum + digits;

    return normalized.length;
}

export function extractPlateCandidates(text: string): string[] {
    const upper = text.toUpperCase().replace(/[^A-Z0-9-\s]/g, " ");
    const scored = new Map<string, number>();

    const addCandidate = (raw: string) => {
        const rawNorm = normalizePlate(raw);
        if (!rawNorm || IGNORED_HUD_WORDS.has(rawNorm)) return;
        for (const variant of correctPlateOcr(raw)) {
            if (IGNORED_HUD_WORDS.has(variant)) continue;
            const score = scorePlateCandidate(variant);
            if (score > 0) {
                scored.set(variant, Math.max(scored.get(variant) ?? 0, score));
            }
        }
    };

    for (const pattern of PLATE_PATTERNS) {
        const matches = upper.match(pattern) ?? [];
        for (const match of matches) addCandidate(match);
    }

    const collapsed = upper.replace(/\s+/g, "");
    if (collapsed.length >= 5) addCandidate(collapsed);

    return Array.from(scored.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([plate]) => plate);
}

function canvasFromImage(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement | null {
    const sourceWidth = "naturalWidth" in img ? img.naturalWidth : img.width;
    const sourceHeight = "naturalHeight" in img ? img.naturalHeight : img.height;

    if (!sourceWidth || !sourceHeight) return null;

    const canvas = document.createElement("canvas");
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / sourceWidth);
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    try {
        ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    } catch {
        return null;
    }

    return canvas;
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = url;
        });
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function fetchCameraSnapshot(location: "entrance" | "exit"): Promise<HTMLImageElement | null> {
    try {
        const res = await GateAccessService.fetchCameraSnapshot(location);
        return await loadImageFromBlob(res.data as Blob);
    } catch {
        return null;
    }
}

/**
 * Browser-side Tesseract OCR has been removed in favor of the dedicated Python LPR
 * service (lpr_gate_controller.py) with 0ms local whitelist lookup.
 */
export async function recognizePlateFromImage(_img: HTMLImageElement): Promise<string | null> {
    return null;
}

export async function recognizePlateCandidatesFromImage(_img: HTMLImageElement): Promise<string[]> {
    return [];
}

export async function recognizePlateCandidatesFromSnapshot(_location: "entrance" | "exit"): Promise<string[]> {
    return [];
}

export async function recognizePlateFromSnapshot(_location: "entrance" | "exit"): Promise<string | null> {
    return null;
}

export async function captureFrameBlob(img: HTMLImageElement): Promise<Blob | null> {
    const canvas = canvasFromImage(img);
    if (!canvas) return null;

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
}

export async function snapshotToBlob(location: "entrance" | "exit"): Promise<Blob | null> {
    try {
        const res = await GateAccessService.fetchCameraSnapshot(location);
        return res.data as Blob;
    } catch {
        return null;
    }
}

export async function terminatePlateOcrWorker(): Promise<void> {
    // No-op: Browser-side Tesseract worker removed
}

