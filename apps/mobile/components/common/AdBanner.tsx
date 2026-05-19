/**
 * Ad banner component that shows ads for free-tier users.
 * - Mobile: AdMob banner ads
 * - Web/Desktop: Google AdSense explicit in-page slot
 * Hidden for Wohnly Pro subscribers.
 */
import { useEffect, useRef } from "react";
import { View, Platform } from "react-native";
import { usePremium } from "@/lib/hooks/usePremium";

const AD_UNIT_IDS = {
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? "ca-app-pub-9336334259937355/6145690883",
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? "ca-app-pub-9336334259937355/4994991829",
};

const ADSENSE_CLIENT_ID = "ca-pub-9336334259937355";
const ADSENSE_SLOT_ID = process.env.EXPO_PUBLIC_ADSENSE_BANNER_SLOT?.trim();
const ADSENSE_SCRIPT_ID = "wohnly-adsense-script";

let BannerAd: any = null;
let BannerAdSize: any = null;

// Only import on native platforms
if (Platform.OS !== "web") {
  try {
    const ads = require("react-native-google-mobile-ads");
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
  } catch {}
}

/** AdSense in-page banner for web/desktop */
function WebAdBanner() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ADSENSE_SLOT_ID) {
      if (__DEV__) console.warn("[Ads] Missing EXPO_PUBLIC_ADSENSE_BANNER_SLOT; web AdSense banner hidden.");
      return;
    }

    if (typeof document !== "undefined" && !document.getElementById(ADSENSE_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = ADSENSE_SCRIPT_ID;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
      document.head.appendChild(script);
    }

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}
  }, []);

  if (!ADSENSE_SLOT_ID) return null;

  return (
    <div ref={ref} style={{ textAlign: "center", padding: "4px 0" }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={ADSENSE_SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

interface AdBannerProps {
  style?: object;
}

export function AdBanner({ style }: AdBannerProps) {
  const { isPremium, isLoading } = usePremium();

  // Only hide ads for confirmed premium users.
  // Show ads while loading (default to showing ads).
  if (isPremium && !isLoading) {
    return null;
  }

  // Web/Desktop: AdSense
  if (Platform.OS === "web") {
    return <WebAdBanner />;
  }

  // Native: AdMob
  if (!BannerAd) return null;

  const adUnitId = Platform.select({
    ios: AD_UNIT_IDS.ios,
    android: AD_UNIT_IDS.android,
    default: AD_UNIT_IDS.android,
  });

  return (
    <View style={[{ alignItems: "center", paddingVertical: 4 }, style]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          if (__DEV__) console.log("[Ads] Banner loaded", Platform.OS, adUnitId);
        }}
        onAdFailedToLoad={(error: unknown) => {
          console.warn("[Ads] Banner failed to load", Platform.OS, adUnitId, error);
        }}
      />
    </View>
  );
}
