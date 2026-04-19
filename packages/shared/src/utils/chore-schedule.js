import { addDays, addWeeks, addMonths, startOfDay, isBefore, isAfter, getDay, setDay, } from "date-fns";
/**
 * Compute all occurrences of a chore within a date range.
 * Uses the chore's frequency and anchor date (lastCompleted or createdAt).
 */
export function getChoreOccurrences(chore, rangeStart, rangeEnd) {
    const anchor = startOfDay(chore.lastCompleted ? new Date(chore.lastCompleted) : new Date(chore.createdAt));
    const dates = [];
    switch (chore.frequency) {
        case "daily": {
            let d = isBefore(anchor, rangeStart) ? startOfDay(rangeStart) : anchor;
            while (!isAfter(d, rangeEnd)) {
                if (!isBefore(d, rangeStart))
                    dates.push(d);
                d = addDays(d, 1);
            }
            break;
        }
        case "weekly": {
            // If dayOfWeek is set, use that; otherwise use the anchor's day
            const targetDay = chore.dayOfWeek ?? getDay(anchor);
            let d = setDay(startOfDay(rangeStart), targetDay, { weekStartsOn: 1 });
            if (isBefore(d, rangeStart))
                d = addWeeks(d, 1);
            while (!isAfter(d, rangeEnd)) {
                dates.push(d);
                d = addWeeks(d, 1);
            }
            break;
        }
        case "biweekly": {
            let d = startOfDay(anchor);
            // Advance to within range
            while (isBefore(d, rangeStart))
                d = addWeeks(d, 2);
            while (!isAfter(d, rangeEnd)) {
                if (!isBefore(d, rangeStart))
                    dates.push(d);
                d = addWeeks(d, 2);
            }
            break;
        }
        case "monthly": {
            let d = startOfDay(anchor);
            while (isBefore(d, rangeStart))
                d = addMonths(d, 1);
            while (!isAfter(d, rangeEnd)) {
                if (!isBefore(d, rangeStart))
                    dates.push(d);
                d = addMonths(d, 1);
            }
            break;
        }
    }
    return dates;
}
//# sourceMappingURL=chore-schedule.js.map