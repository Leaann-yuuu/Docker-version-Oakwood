export function normalizePlate(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatPlateDisplay(value: string): string {
    const normalized = normalizePlate(value);
    return normalized || value.toUpperCase();
}

export function formatPlateInput(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}


