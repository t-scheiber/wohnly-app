import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import en from "./en.json";
import de from "./de.json";

const deviceLang = getLocales()[0]?.languageCode || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: deviceLang === "de" ? "de" : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
