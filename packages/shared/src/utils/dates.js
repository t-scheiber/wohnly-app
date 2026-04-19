/**
 * Format a date for display
 */
export function formatDate(date, locale = "de-DE", options) {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString(locale, options ?? {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
/**
 * Format a date with time
 */
export function formatDateTime(date, locale = "de-DE") {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
/**
 * Check if a date is in the past
 */
export function isPast(date) {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.getTime() < Date.now();
}
/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(date, locale = "en") {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = Date.now();
    const diff = d.getTime() - now;
    const absDiff = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (absDiff < 60_000)
        return rtf.format(Math.round(diff / 1000), "second");
    if (absDiff < 3_600_000)
        return rtf.format(Math.round(diff / 60_000), "minute");
    if (absDiff < 86_400_000)
        return rtf.format(Math.round(diff / 3_600_000), "hour");
    if (absDiff < 2_592_000_000)
        return rtf.format(Math.round(diff / 86_400_000), "day");
    return rtf.format(Math.round(diff / 2_592_000_000), "month");
}
//# sourceMappingURL=dates.js.map