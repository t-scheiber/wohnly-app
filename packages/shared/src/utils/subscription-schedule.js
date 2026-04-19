import { addWeeks, addMonths, startOfDay, isBefore, isAfter, } from "date-fns";
/**
 * Compute all billing dates for a subscription within a date range.
 * Returns empty array if billingDate is not set or subscription is inactive.
 */
export function getSubscriptionBillingDates(sub, rangeStart, rangeEnd) {
    if (!sub.billingDate || !sub.active)
        return [];
    const anchor = startOfDay(new Date(sub.billingDate));
    const dates = [];
    const advance = (d) => {
        switch (sub.frequency) {
            case "weekly": return addWeeks(d, 1);
            case "biweekly": return addWeeks(d, 2);
            case "monthly": return addMonths(d, 1);
            case "quarterly": return addMonths(d, 3);
            case "yearly": return addMonths(d, 12);
            default: return addMonths(d, 1);
        }
    };
    let d = anchor;
    // Go backwards if anchor is after range to find the right start
    // Go forwards if anchor is before range
    while (isAfter(d, rangeEnd)) {
        // Anchor is past the range — go backward (shouldn't happen often)
        break;
    }
    while (isBefore(d, rangeStart)) {
        d = advance(d);
    }
    while (!isAfter(d, rangeEnd)) {
        dates.push(d);
        d = advance(d);
    }
    return dates;
}
//# sourceMappingURL=subscription-schedule.js.map