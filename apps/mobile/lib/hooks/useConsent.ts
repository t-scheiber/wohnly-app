/**
 * GDPR consent management for Google Mobile Ads.
 * Required for EU users before showing personalized ads.
 * Uses Google's User Messaging Platform (UMP) SDK bundled with react-native-google-mobile-ads.
 */
import { useState, useEffect } from "react";
import { Platform } from "react-native";

let AdsConsent: any = null;
let AdsConsentStatus: any = null;

if (Platform.OS !== "web") {
  try {
    const ads = require("react-native-google-mobile-ads");
    AdsConsent = ads.AdsConsent;
    AdsConsentStatus = ads.AdsConsentStatus;
  } catch {}
}

export function useConsent() {
  const [consentReady, setConsentReady] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS === "web" || !AdsConsent) {
      setConsentReady(true);
      return;
    }

    (async () => {
      try {
        // Request consent info update
        const consentInfo = await AdsConsent.requestInfoUpdate();

        // Show consent form if required and available
        if (
          consentInfo.isConsentFormAvailable &&
          consentInfo.status === AdsConsentStatus.REQUIRED
        ) {
          await AdsConsent.showForm();
        }

        setConsentReady(true);
      } catch {
        // Consent failed — still allow app to function, just don't show personalized ads
        setConsentReady(true);
      }
    })();
  }, []);

  return { consentReady };
}
