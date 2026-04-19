/**
 * Format a number as currency
 */
export function formatCurrency(amount, currency = "EUR", locale = "de-DE") {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
    }).format(num);
}
export const CURRENCIES = [
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
    { code: "SEK", symbol: "kr", name: "Swedish Krona" },
    { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
    { code: "DKK", symbol: "kr", name: "Danish Krone" },
    { code: "PLN", symbol: "zł", name: "Polish Zloty" },
    { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
    { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
    { code: "RON", symbol: "lei", name: "Romanian Leu" },
    { code: "BGN", symbol: "лв", name: "Bulgarian Lev" },
    { code: "ISK", symbol: "kr", name: "Icelandic Krona" },
    { code: "TRY", symbol: "₺", name: "Turkish Lira" },
    { code: "RUB", symbol: "₽", name: "Russian Ruble" },
    { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
    { code: "KRW", symbol: "₩", name: "South Korean Won" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "THB", symbol: "฿", name: "Thai Baht" },
    { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
    { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
    { code: "PHP", symbol: "₱", name: "Philippine Peso" },
    { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
    { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
    { code: "TWD", symbol: "NT$", name: "Taiwan Dollar" },
    { code: "BRL", symbol: "R$", name: "Brazilian Real" },
    { code: "MXN", symbol: "Mex$", name: "Mexican Peso" },
    { code: "ARS", symbol: "AR$", name: "Argentine Peso" },
    { code: "CLP", symbol: "CL$", name: "Chilean Peso" },
    { code: "COP", symbol: "COL$", name: "Colombian Peso" },
    { code: "PEN", symbol: "S/", name: "Peruvian Sol" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
    { code: "ZAR", symbol: "R", name: "South African Rand" },
    { code: "EGP", symbol: "E£", name: "Egyptian Pound" },
    { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
    { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
    { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
    { code: "MAD", symbol: "MAD", name: "Moroccan Dirham" },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
    { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
    { code: "QAR", symbol: "QR", name: "Qatari Riyal" },
    { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar" },
    { code: "BHD", symbol: "BD", name: "Bahraini Dinar" },
    { code: "ILS", symbol: "₪", name: "Israeli Shekel" },
    { code: "JOD", symbol: "JD", name: "Jordanian Dinar" },
    { code: "GEL", symbol: "₾", name: "Georgian Lari" },
    { code: "AMD", symbol: "֏", name: "Armenian Dram" },
    { code: "RSD", symbol: "din", name: "Serbian Dinar" },
    { code: "BAM", symbol: "KM", name: "Bosnia Mark" },
    { code: "ALL", symbol: "L", name: "Albanian Lek" },
    { code: "MKD", symbol: "ден", name: "Macedonian Denar" },
    { code: "MDL", symbol: "L", name: "Moldovan Leu" },
];
/**
 * Parse a currency string to a number
 */
export function parseCurrencyInput(input) {
    // Handle comma as decimal separator (European format)
    const normalized = input.replace(/[^\d.,\-]/g, "").replace(",", ".");
    const num = parseFloat(normalized);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
}
//# sourceMappingURL=currency.js.map