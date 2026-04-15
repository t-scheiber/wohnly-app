/**
 * GDPR consent management for Google Mobile Ads.
 * Required for EU users before showing personalized ads.
 * Uses Google's User Messaging Platform (UMP) SDK bundled with react-native-google-mobile-ads.
 */
import { useState, useEffect } from "react";
import { Platform } from "react-native";

let MobileAds: any = null;
let AdsConsent: any = null;
let AdsConsentStatus: any = null;

if (Platform.OS !== "web") {
  try {
    const ads = require("react-native-google-mobile-ads");
    MobileAds = ads.default ?? ads.MobileAds;
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
        // Initialize the Google Mobile Ads SDK before any ad operations
        if (MobileAds) {
          await MobileAds().initialize();
        }

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
        // Consent or ads init failed — still allow app to function
        setConsentReady(true);
      }
    })();
  }, []);

  return { consentReady };
}
