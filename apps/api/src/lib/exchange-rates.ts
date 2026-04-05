import { prisma } from "./prisma.js";

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Free API: https://open.er-api.com/v6/latest/{base}
// No API key needed, 1500 req/month free
const API_URL = "https://open.er-api.com/v6/latest";

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: Date;
}

/**
 * Get exchange rates for a base currency.
 * Returns cached rates if less than 24h old, otherwise fetches fresh.
 */
export async function getExchangeRates(base: string = "EUR"): Promise<ExchangeRates> {
  // Check cache
  const cached = await prisma.exchangeRate.findFirst({
    where: { base },
    orderBy: { fetchedAt: "desc" },
  });

  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_DURATION_MS) {
    return {
      base: cached.base,
      rates: cached.rates as Record<string, number>,
      fetchedAt: cached.fetchedAt,
    };
  }

  // Fetch fresh rates
  try {
    const res = await fetch(`${API_URL}/${base}`);
    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);

    const data = await res.json();
    const rates = data.rates as Record<string, number>;

    // Store in cache (upsert by deleting old and creating new)
    await prisma.exchangeRate.deleteMany({ where: { base } });
    const record = await prisma.exchangeRate.create({
      data: { base, rates },
    });

    return { base, rates, fetchedAt: record.fetchedAt };
  } catch (err) {
    // If fetch fails but we have stale cache, use it
    if (cached) {
      return {
        base: cached.base,
        rates: cached.rates as Record<string, number>,
        fetchedAt: cached.fetchedAt,
      };
    }
    throw err;
  }
}

/**
 * Convert an amount from one currency to another.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  base: string
): number {
  if (fromCurrency === toCurrency) return amount;

  // Convert from → base → to
  const fromRate = fromCurrency === base ? 1 : rates[fromCurrency];
  const toRate = toCurrency === base ? 1 : rates[toCurrency];

  if (!fromRate || !toRate) return amount; // Fallback: no conversion

  const inBase = amount / fromRate;
  return Math.round(inBase * toRate * 100) / 100;
}
