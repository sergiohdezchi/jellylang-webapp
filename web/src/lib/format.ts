export function formatClock(totalSeconds: number | null | undefined): string {
    const value = Math.max(0, Math.floor(totalSeconds ?? 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = value % 60;
    const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
    return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}

/** 600 -> "10m", 86400 -> "1d", 3888000 -> "1.5mo" */
export function formatInterval(seconds: number): string {
    const minutes = seconds / 60;
    if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
    const hours = minutes / 60;
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = hours / 24;
    if (days < 30) return `${Math.round(days)}d`;
    const months = days / 30;
    if (months < 12) return `${trim(months)}mo`;
    return `${trim(days / 365)}y`;
}

export function formatNumber(value: number, locale: string): string {
    return new Intl.NumberFormat(locale).format(value);
}

function trim(value: number): string {
    return value.toFixed(1).replace(/\.0$/, "");
}
