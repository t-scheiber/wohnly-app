interface ChoreForSchedule {
    frequency: string;
    dayOfWeek?: number | null;
    lastCompleted?: Date | string | null;
    createdAt: Date | string;
}
/**
 * Compute all occurrences of a chore within a date range.
 * Uses the chore's frequency and anchor date (lastCompleted or createdAt).
 */
export declare function getChoreOccurrences(chore: ChoreForSchedule, rangeStart: Date, rangeEnd: Date): Date[];
export {};
