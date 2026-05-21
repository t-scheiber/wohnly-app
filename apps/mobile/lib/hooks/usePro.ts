import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { REVENUECAT_ENTITLEMENT_ID } from "@/lib/payments/setup";
import Purchases from "react-native-purchases";
import type { CustomerInfo } from "react-native-purchases";
import { useEntitlements } from "@/lib/api/queries";
import { authClient } from "@/lib/auth/client";

/**
 * Hook to check and reactively track the user's Pro status.
 *
 * Combines two sources so paying on ANY platform grants Pro everywhere:
 * - RevenueCat (mobile in-app purchases — iOS/Android)
 * - API entitlements (database — Stripe web/desktop purchases + RevenueCat webhooks)
 *
 * A user is Pro if EITHER source says so.
 */
export function usePro() {
  const [rcPro, setRcPro] = useState(false);
  const [rcLoading, setRcLoading] = useState(Platform.OS !== "web");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const { data: session } = authClient.useSession();

  // API entitlements — works on all platforms, picks up Stripe + RevenueCat purchases
  const { data: entitlements, isLoading: apiLoading } = useEntitlements(!!session);

  const checkEntitlement = useCallback((info: CustomerInfo) => {
    const active = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID] !== undefined;
    setRcPro(active);
    setCustomerInfo(info);
    setRcLoading(false);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!session) {
      setRcPro(false);
      setRcLoading(false);
      return;
    }

    // Initial check
    Purchases.getCustomerInfo()
      .then(checkEntitlement)
      .catch(() => setRcLoading(false));

    // Listen for changes (purchase, restore, etc.)
    Purchases.addCustomerInfoUpdateListener(checkEntitlement);
  }, [checkEntitlement, session]);

  // Pro if EITHER RevenueCat or the API says so
  const isPro = rcPro || (entitlements?.pro ?? false);
  const isLoading = rcLoading || apiLoading;

  return { isPro, isLoading, customerInfo };
}
