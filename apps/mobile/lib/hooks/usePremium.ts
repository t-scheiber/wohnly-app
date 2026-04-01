import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import type { CustomerInfo } from "react-native-purchases";
import { useEntitlements } from "@/lib/api/queries";

/**
 * Hook to check and reactively track the user's premium status.
 *
 * Combines two sources so paying on ANY platform grants premium everywhere:
 * - RevenueCat (mobile in-app purchases — iOS/Android)
 * - API entitlements (database — Stripe web/desktop purchases + RevenueCat webhooks)
 *
 * A user is premium if EITHER source says so.
 */
export function usePremium() {
  const [rcPremium, setRcPremium] = useState(false);
  const [rcLoading, setRcLoading] = useState(Platform.OS !== "web");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // API entitlements — works on all platforms, picks up Stripe + RevenueCat purchases
  const { data: entitlements, isLoading: apiLoading } = useEntitlements();

  const checkEntitlement = useCallback((info: CustomerInfo) => {
    const active = info.entitlements.active["Wohnly Pro"] !== undefined;
    setRcPremium(active);
    setCustomerInfo(info);
    setRcLoading(false);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Initial check
    Purchases.getCustomerInfo()
      .then(checkEntitlement)
      .catch(() => setRcLoading(false));

    // Listen for changes (purchase, restore, etc.)
    Purchases.addCustomerInfoUpdateListener(checkEntitlement);
  }, [checkEntitlement]);

  // Premium if EITHER RevenueCat or the API says so
  const isPremium = rcPremium || (entitlements?.premium ?? false);
  const isLoading = rcLoading || apiLoading;

  return { isPremium, isLoading, customerInfo };
}
