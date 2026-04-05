import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "wohnly_onboarding_complete";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        setShowOnboarding(value !== "true");
        setLoaded(true);
      })
      .catch(() => {
        setShowOnboarding(true);
        setLoaded(true);
      });
  }, []);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    AsyncStorage.setItem(STORAGE_KEY, "true").catch(() => {});
  }, []);

  return { showOnboarding: loaded && showOnboarding, completeOnboarding };
}
