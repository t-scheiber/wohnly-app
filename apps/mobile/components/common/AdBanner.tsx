/**
 * Ad banner component that shows ads for free-tier users.
 * Hidden for Wohnly Pro subscribers.
 */
import { View, Platform } from "react-native";
import { usePremium } from "@/lib/hooks/usePremium";

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

interface AdBannerProps {
  style?: object;
}

export function AdBanner({ style }: AdBannerProps) {
  const { isPremium, isLoading } = usePremium();

  // Don't show ads for premium users, on web, or while loading
  if (isPremium || isLoading || Platform.OS === "web" || !BannerAd) {
    return null;
  }

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
