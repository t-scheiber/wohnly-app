import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { Platform } from "react-native";

const API_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "appl_RAWeWdPXRbUnvPgaegDJzmpHCwO",
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "goog_drczxITwJXQiqAzjihMOBakvibf",
};

/**
 * Initialize RevenueCat. Call once on app start after auth.
 */
export async function initRevenueCat(userId: string) {
  if (Platform.OS === "web") return; // RevenueCat is mobile-only

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

  const apiKey = Platform.select({
    ios: API_KEYS.ios,
    android: API_KEYS.android,
    default: API_KEYS.android,
  });

  if (!apiKey) {
    console.warn("No RevenueCat API key configured");
    return;
  }

  Purchases.configure({
    apiKey,
    appUserID: userId, // Link to Better Auth user ID
  });
}

/**
 * Check if the current user has the "Wohnly Pro" entitlement.
 */
export async function checkPremium(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active["Wohnly Pro"] !== undefined;
  } catch (err) {
    console.error("Failed to check premium status:", err);
    return false;
  }
}

/**
 * Purchase the lifetime "Wohnly Pro" package.
 * Returns true if the purchase was successful.
 */
export async function purchaseLifetime(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const lifetime = offerings.current?.lifetime;

    if (!lifetime) {
      console.error("No lifetime package found in offerings");
      return false;
    }

    const { customerInfo } = await Purchases.purchasePackage(lifetime);
    return customerInfo.entitlements.active["Wohnly Pro"] !== undefined;
  } catch (err: unknown) {
    // User cancelled is not an error
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
    return customerInfo.entitlements.active["Wohnly Pro"] !== undefined;
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
