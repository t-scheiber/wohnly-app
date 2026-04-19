/**
 * Format a number as currency
 */
export declare function formatCurrency(amount: number | string, currency?: string, locale?: string): string;
/**
 * Full currency list for multi-currency support
 */
export interface CurrencyInfo {
    code: string;
    symbol: string;
    name: string;
}
export declare const CURRENCIES: CurrencyInfo[];
/**
 * Parse a currency string to a number
 */
export declare function parseCurrencyInput(input: string): number | null;
