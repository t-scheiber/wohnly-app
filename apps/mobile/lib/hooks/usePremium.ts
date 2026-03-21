import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import type { CustomerInfo } from "react-native-purchases";

/**
 * Hook to check and reactively track the user's "Wohnly Pro" entitlement.
 * Uses RevenueCat's listener for real-time updates after purchases.
 */
export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const checkEntitlement = useCallback((info: CustomerInfo) => {
    const active = info.entitlements.active["Wohnly Pro"] !== undefined;
    setIsPremium(active);
    setCustomerInfo(info);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsLoading(false);
      return;
    }

    // Initial check
    Purchases.getCustomerInfo()
      .then(checkEntitlement)
      .catch(() => setIsLoading(false));

    // Listen for changes (purchase, restore, etc.)
    const listener = Purchases.addCustomerInfoUpdateListener(checkEntitlement);

    return () => {
      listener.remove();
    };
  }, [checkEntitlement]);

  return { isPremium, isLoading, customerInfo };
}
