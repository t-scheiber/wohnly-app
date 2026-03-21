/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number | string,
  currency = "EUR",
  locale = "de-DE"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(num);
}

/**
 * Parse a currency string to a number
 */
export function parseCurrencyInput(input: string): number | null {
  // Handle comma as decimal separator (European format)
  const normalized = input.replace(/[^\d.,\-]/g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}
