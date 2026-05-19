import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";
import { Platform } from "react-native";

/** Must match RevenueCat entitlement identifier in the dashboard. */
export const REVENUECAT_ENTITLEMENT_ID = "Wohnly Pro";

/** RevenueCat public SDK keys (safe to ship in the client; override via EXPO_PUBLIC_*). */
const REVENUECAT_PUBLIC_API_KEYS = {
  ios: "appl_RAWeWdPXRbUnvPgaegDJzmpHCwO",
  android: "goog_drczxITwJXQiqAzjihMOBakvibf",
} as const;

const DEFAULT_STORE_PRODUCT_IDS = {
  ios: "wohnly_pro_lifetime",
  android: "wohnly_pro_lifetime",
} as const;

/** Show paywall UI without a live store product (dev / App Store screenshot). */
export function isPaywallPreviewEnabled(): boolean {
  return (
    __DEV__ || process.env.EXPO_PUBLIC_PAYWALL_PREVIEW === "true"
  );
}

export function getRevenueCatPublicApiKey(): string | undefined {
  if (Platform.OS === "web") return undefined;
  const raw = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? REVENUECAT_PUBLIC_API_KEYS.ios,
    android:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? REVENUECAT_PUBLIC_API_KEYS.android,
    default:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? REVENUECAT_PUBLIC_API_KEYS.android,
  });
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

function getConfiguredOfferingIdentifier(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

function getConfiguredStoreProductId(): string | undefined {
  const raw = Platform.select({
    ios:
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_PRODUCT_ID ?? DEFAULT_STORE_PRODUCT_IDS.ios,
    android:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID ??
      DEFAULT_STORE_PRODUCT_IDS.android,
    default:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID ??
      DEFAULT_STORE_PRODUCT_IDS.android,
  });
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

/**
 * RevenueCat / store misconfiguration (e.g. App Store product not linked to an offering).
 * Used to show a helpful message instead of a raw SDK string.
 */
export function isRevenueCatStoreSetupError(error: PurchasesError | Error | unknown): boolean {
  const msg = String(
    error && typeof error === "object" && "message" in error ? (error as { message?: string }).message : error,
  ).toLowerCase();
  const code =
    error && typeof error === "object" && "readableErrorCode" in error
      ? String((error as PurchasesError).readableErrorCode ?? "")
      : "";
  if (code === "CONFIGURATION_ERROR" || code.includes("CONFIGURATION")) return true;
  return (
    msg.includes("app store product") ||
    msg.includes("no app store product") ||
    msg.includes("google play product") ||
    (msg.includes("store product") && msg.includes("registered")) ||
    msg.includes("revcat sdk troubleshooting") ||
    msg.includes("configuration error") ||
    msg.includes("why-are-offerings-empty") ||
    msg.includes("offerings empty")
  );
}

/** Package is only purchasable when the native store returned product metadata (price). */
export function packageHasStoreProduct(pkg: PurchasesPackage | null | undefined): boolean {
  const product = pkg?.product;
  if (!product?.identifier) return false;
  return product.price > 0 || Boolean(product.priceString);
}

export function pickPurchasablePackage(
  offering: PurchasesOffering | null | undefined,
): PurchasesPackage | null {
  if (!offering) return null;
  const candidates = [
    offering.lifetime,
    offering.annual,
    offering.monthly,
    offering.weekly,
    offering.sixMonth,
    offering.threeMonth,
    offering.twoMonth,
    ...(offering.availablePackages ?? []),
  ].filter(Boolean) as PurchasesPackage[];

  for (const pkg of candidates) {
    if (packageHasStoreProduct(pkg)) return pkg;
  }

  return null;
}

function getOfferingByIdentifier(
  offerings: PurchasesOfferings,
  identifier: string | undefined,
): PurchasesOffering | null {
  if (!identifier) return null;
  return offerings.all[identifier] ?? null;
}

function findOfferingWithPurchasablePackage(
  offerings: PurchasesOfferings,
): PurchasesOffering | null {
  const preferredId = getConfiguredOfferingIdentifier();
  const ordered: PurchasesOffering[] = [];

  const preferred = getOfferingByIdentifier(offerings, preferredId);
  if (preferred) ordered.push(preferred);
  if (offerings.current) ordered.push(offerings.current);

  for (const offering of Object.values(offerings.all)) {
    if (!ordered.includes(offering)) ordered.push(offering);
  }

  for (const offering of ordered) {
    if (pickPurchasablePackage(offering)) return offering;
  }

  return null;
}

export type PaywallPurchaseTarget =
  | { kind: "package"; pkg: PurchasesPackage; offering: PurchasesOffering }
  | { kind: "product"; product: PurchasesStoreProduct };

/**
 * Resolves a package (preferred) or store product for the current platform.
 */
export async function resolvePaywallPurchaseTarget(): Promise<PaywallPurchaseTarget | null> {
  const offerings = await Purchases.getOfferings();
  const offering = findOfferingWithPurchasablePackage(offerings);
  const pkg = pickPurchasablePackage(offering);

  if (offering && pkg && packageHasStoreProduct(pkg)) {
    return { kind: "package", pkg, offering };
  }

  const productId = getConfiguredStoreProductId();
  if (!productId) return null;

  try {
    const products = await Purchases.getProducts([productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    const product = products[0];
    if (product && (product.price > 0 || product.priceString)) {
      return { kind: "product", product };
    }
  } catch (err) {
    console.error("[RevenueCat] getProducts failed:", err);
  }

  return null;
}

export type PaywallValidationResult =
  | { ok: true; target: PaywallPurchaseTarget }
  | {
      ok: false;
      reason:
        | "missing_api_key"
        | "no_current_offering"
        | "no_packages"
        | "no_store_products"
        | "offerings_error";
      underlyingMessage?: string;
    };

/**
 * Verifies RevenueCat has a purchasable product for this store before showing the paywall.
 */
export async function validatePaywallReady(): Promise<PaywallValidationResult> {
  if (Platform.OS === "web") {
    return { ok: true, target: { kind: "product", product: { priceString: "" } as PurchasesStoreProduct } };
  }

  const apiKey = getRevenueCatPublicApiKey();
  if (!apiKey) return { ok: false, reason: "missing_api_key" };

  try {
    const offerings = await Purchases.getOfferings();
    const hasAnyOffering =
      Boolean(offerings.current) || Object.keys(offerings.all ?? {}).length > 0;

    if (!hasAnyOffering) {
      return { ok: false, reason: "no_current_offering" };
    }

    const anyPackageMetadata = (() => {
      const ordered = [
        offerings.current,
        ...Object.values(offerings.all ?? {}),
      ].filter(Boolean) as PurchasesOffering[];
      for (const offering of ordered) {
        const pkg =
          offering.lifetime ??
          offering.annual ??
          offering.monthly ??
          offering.availablePackages?.[0];
        if (pkg) return true;
      }
      return false;
    })();

    if (!anyPackageMetadata && !getConfiguredStoreProductId()) {
      return { ok: false, reason: "no_packages" };
    }

    const target = await resolvePaywallPurchaseTarget();
    if (!target) {
      return { ok: false, reason: "no_store_products" };
    }

    return { ok: true, target };
  } catch (err) {
    if (isRevenueCatStoreSetupError(err)) {
      return { ok: false, reason: "no_store_products", underlyingMessage: String(err) };
    }
    return {
      ok: false,
      reason: "offerings_error",
      underlyingMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getPaywallPriceString(): Promise<string | null> {
  const target = await resolvePaywallPurchaseTarget();
  if (!target) return null;
  if (target.kind === "package") return target.pkg.product.priceString;
  return target.product.priceString;
}

/**
 * Initialize RevenueCat. Call once on app start after auth.
 */
export async function initRevenueCat(userId: string) {
  if (Platform.OS === "web") return;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

  const apiKey = getRevenueCatPublicApiKey();
  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        "[RevenueCat] Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY — in-app purchases are disabled.",
      );
    }
    return;
  }

  Purchases.configure({
    apiKey,
    appUserID: userId,
  });
}

/**
 * Check if the current user has the "Wohnly Pro" entitlement.
 */
export async function checkPremium(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== undefined;
  } catch (err) {
    console.error("Failed to check premium status:", err);
    return false;
  }
}

async function executePurchase(target: PaywallPurchaseTarget) {
  if (target.kind === "package") {
    return Purchases.purchasePackage(target.pkg);
  }
  return Purchases.purchaseStoreProduct(target.product);
}

/**
 * Purchase the lifetime "Wohnly Pro" package.
 * Returns true if the purchase was successful.
 */
export async function purchaseLifetime(): Promise<boolean> {
  try {
    const target = await resolvePaywallPurchaseTarget();
    if (!target) {
      console.error("[RevenueCat] No purchasable package or product for this store");
      return false;
    }

    const { customerInfo } = await executePurchase(target);
    return customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== undefined;
  } catch (err: unknown) {
    if ((err as { userCancelled?: boolean })?.userCancelled) {
      return false;
    }
    console.error("Purchase failed:", err);
    throw err;
  }
}

/**
 * Restore previous purchases (e.g., after reinstall or new device).
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== undefined;
  } catch (err) {
    console.error("Restore failed:", err);
    throw err;
  }
}

/**
 * Get the current customer info for display.
 */
export async function getCustomerInfo() {
  if (Platform.OS === "web") return null;

  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.error("Failed to get customer info:", err);
    return null;
  }
}

/**
 * Get available offerings for paywall display.
 */
export async function getOfferings() {
  if (Platform.OS === "web") return null;

  try {
    return await Purchases.getOfferings();
  } catch (err) {
    console.error("Failed to get offerings:", err);
    return null;
  }
}
