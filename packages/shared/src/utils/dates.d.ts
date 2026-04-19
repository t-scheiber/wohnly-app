/**
 * Format a date for display
 */
export declare function formatDate(date: Date | string, locale?: string, options?: Intl.DateTimeFormatOptions): string;
/**
 * Format a date with time
 */
export declare function formatDateTime(date: Date | string, locale?: string): string;
/**
 * Check if a date is in the past
 */
export declare function isPast(date: Date | string): boolean;
/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export declare function getRelativeTime(date: Date | string, locale?: string): string;
