/**
 * Ad banner component that shows ads for free-tier users.
 * - Mobile: AdMob banner ads
 * - Web/Desktop: Google AdSense (auto ads injected via +html.tsx,
 *   plus an explicit in-page slot here)
 * Hidden for Wohnly Pro subscribers.
 */
import { useEffect, useRef } from "react";
import { View, Platform } from "react-native";
import { usePro } from "@/lib/hooks/usePro";

const AD_UNIT_IDS = {
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? "ca-app-pub-9336334259937355/6145690883",
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? "ca-app-pub-9336334259937355/4994991829",
};

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
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div ref={ref} style={{ textAlign: "center", padding: "4px 0" }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-9336334259937355"
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
  const { isPro, isLoading } = usePro();

  // Only hide ads for confirmed Pro users.
  // Show ads while loading (default to showing ads).
  if (isPro && !isLoading) {
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
      />
    </View>
  );
}
