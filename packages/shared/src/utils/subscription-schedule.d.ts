interface SubscriptionForSchedule {
    billingDate?: Date | string | null;
    frequency: string;
    active: boolean;
}
/**
 * Compute all billing dates for a subscription within a date range.
 * Returns empty array if billingDate is not set or subscription is inactive.
 */
export declare function getSubscriptionBillingDates(sub: SubscriptionForSchedule, rangeStart: Date, rangeEnd: Date): Date[];
export {};
