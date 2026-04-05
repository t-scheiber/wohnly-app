/**
 * Receipt parser — extracts structured data from raw OCR text.
 *
 * Uses regex/heuristics to find:
 * - Total amount
 * - Date
 * - Merchant/store name
 * - Individual line items (name + price)
 *
 * Supports EN + DE keywords at minimum.
 */

export interface ParsedReceipt {
  merchant: string | null;
  date: string | null; // ISO date string
  total: number | null;
  currency: string | null;
  lineItems: { name: string; amount: number }[];
}

// Keywords indicating a total line (multi-language)
const TOTAL_KEYWORDS = [
  // English
  "total", "grand total", "amount due", "balance due", "sum", "subtotal",
  // German
  "gesamt", "summe", "gesamtbetrag", "endbetrag", "zu zahlen", "betrag",
  // French
  "total", "montant", "somme",
  // Spanish
  "total", "importe", "suma",
];

// Currency symbol patterns
const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR", "\\$": "USD", "£": "GBP", "CHF": "CHF",
  "Fr\\.": "CHF", "kr": "SEK", "zł": "PLN", "Kč": "CZK",
  "Ft": "HUF", "₺": "TRY", "¥": "JPY", "₹": "INR",
  "R\\$": "BRL", "C\\$": "CAD", "A\\$": "AUD",
};

// Common date formats
const DATE_PATTERNS = [
  // DD.MM.YYYY or DD/MM/YYYY
  /(\d{1,2})[./](\d{1,2})[./](20\d{2})/,
  // YYYY-MM-DD
  /(20\d{2})-(\d{1,2})-(\d{1,2})/,
  // DD-MM-YYYY
  /(\d{1,2})-(\d{1,2})-(20\d{2})/,
  // MM/DD/YYYY (US format)
  /(\d{1,2})\/(\d{1,2})\/(20\d{2})/,
];

/**
 * Extract a price from a text line.
 * Handles: 12.99, 12,99, €12.99, 12.99€, $ 12.99, etc.
 */
function extractPrice(text: string): number | null {
  // Match patterns like 12.99, 12,99, 1.234,56, 1,234.56
  const patterns = [
    /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/,  // price at end of line
    /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/,        // price anywhere
    /(\d+)\s*$/,                                 // whole number at end
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let numStr = match[1];
      // Determine if comma or dot is decimal separator
      const lastComma = numStr.lastIndexOf(",");
      const lastDot = numStr.lastIndexOf(".");

      if (lastComma > lastDot) {
        // European: 1.234,56 → 1234.56
        numStr = numStr.replace(/\./g, "").replace(",", ".");
      } else {
        // US/UK: 1,234.56 → 1234.56
        numStr = numStr.replace(/,/g, "");
      }

      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0 && num < 100000) return num;
    }
  }
  return null;
}

/**
 * Parse raw OCR text into structured receipt data.
 */
export function parseReceipt(rawText: string): ParsedReceipt {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  let merchant: string | null = null;
  let date: string | null = null;
  let total: number | null = null;
  let currency: string | null = null;
  const lineItems: { name: string; amount: number }[] = [];

  // 1. Merchant: usually the first non-empty, non-date, non-address line
  for (const line of lines.slice(0, 5)) {
    // Skip lines that look like addresses, dates, or phone numbers
    if (/^\d{4,}/.test(line)) continue;
    if (/^\+?\d[\d\s-]{7,}$/.test(line)) continue;
    if (DATE_PATTERNS.some((p) => p.test(line))) continue;
    if (line.length < 3) continue;
    merchant = line;
    break;
  }

  // 2. Date: find first date pattern
  for (const line of lines) {
    for (const pattern of DATE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        try {
          const groups = match.slice(1).map(Number);
          let y: number, m: number, d: number;

          if (groups[0] > 2000) {
            // YYYY-MM-DD
            [y, m, d] = groups;
          } else if (groups[2] > 2000) {
            // DD.MM.YYYY or MM/DD/YYYY
            // Assume DD.MM.YYYY (European) if first number > 12
            if (groups[0] > 12) {
              [d, m, y] = groups;
            } else if (groups[1] > 12) {
              [m, d, y] = groups;
            } else {
              // Ambiguous — assume DD.MM.YYYY (European default)
              [d, m, y] = groups;
            }
          } else {
            continue;
          }

          if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            break;
          }
        } catch {
          continue;
        }
      }
    }
    if (date) break;
  }

  // 3. Currency: detect from symbols in text
  const fullText = rawText.toLowerCase();
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (new RegExp(symbol, "i").test(rawText)) {
      currency = code;
      break;
    }
  }

  // 4. Total: find lines with total keywords + price
  const totalKeywordPattern = new RegExp(
    `(${TOTAL_KEYWORDS.join("|")})`,
    "i"
  );

  // Search from bottom up (total is usually at the end)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (totalKeywordPattern.test(line)) {
      const price = extractPrice(line);
      if (price !== null) {
        total = price;
        break;
      }
      // Check next line too (total might be on the line below the keyword)
      if (i + 1 < lines.length) {
        const nextPrice = extractPrice(lines[i + 1]);
        if (nextPrice !== null) {
          total = nextPrice;
          break;
        }
      }
    }
  }

  // 5. Line items: lines with a name + price that aren't the total
  for (const line of lines) {
    // Skip total/header lines
    if (totalKeywordPattern.test(line)) continue;
    if (line.length < 4) continue;

    const price = extractPrice(line);
    if (price !== null && price !== total) {
      // Extract name: everything before the price
      const priceStr = price.toFixed(2).replace(".", "[.,]");
      const nameMatch = line.match(new RegExp(`^(.+?)\\s*[€$£]?\\s*${priceStr}`));
      const name = nameMatch?.[1]?.trim();

      if (name && name.length >= 2 && name.length < 80) {
        lineItems.push({ name, amount: price });
      }
    }
  }

  // If no total found but we have line items, sum them
  if (total === null && lineItems.length > 0) {
    total = Math.round(lineItems.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  }

  return { merchant, date, total, currency, lineItems };
}
