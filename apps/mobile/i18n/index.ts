import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./en.json";
import de from "./de.json";
import fr from "./fr.json";
import es from "./es.json";
import pt from "./pt.json";
import it from "./it.json";
import nl from "./nl.json";
import pl from "./pl.json";
import ro from "./ro.json";
import hu from "./hu.json";
import bg from "./bg.json";
import uk from "./uk.json";
import ru from "./ru.json";
import nb from "./nb.json";
import sv from "./sv.json";
import fi from "./fi.json";
import da from "./da.json";
import is from "./is.json";
import lt from "./lt.json";
import lv from "./lv.json";
import et from "./et.json";
import hr from "./hr.json";
import sr from "./sr.json";
import sl from "./sl.json";
import cs from "./cs.json";
import sk from "./sk.json";
import el from "./el.json";
import tr from "./tr.json";
import zh from "./zh.json";
import ja from "./ja.json";
import ko from "./ko.json";
import hi from "./hi.json";
import th from "./th.json";
import vi from "./vi.json";
import id from "./id.json";
import bn from "./bn.json";
import ms from "./ms.json";
import tl from "./tl.json";
import sw from "./sw.json";
import ta from "./ta.json";
import te from "./te.json";
import mr from "./mr.json";

const resources = {
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
  pt: { translation: pt },
  it: { translation: it },
  nl: { translation: nl },
  pl: { translation: pl },
  ro: { translation: ro },
  hu: { translation: hu },
  bg: { translation: bg },
  uk: { translation: uk },
  ru: { translation: ru },
  nb: { translation: nb },
  sv: { translation: sv },
  fi: { translation: fi },
  da: { translation: da },
  is: { translation: is },
  lt: { translation: lt },
  lv: { translation: lv },
  et: { translation: et },
  hr: { translation: hr },
  sr: { translation: sr },
  sl: { translation: sl },
  cs: { translation: cs },
  sk: { translation: sk },
  el: { translation: el },
  tr: { translation: tr },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  hi: { translation: hi },
  th: { translation: th },
  vi: { translation: vi },
  id: { translation: id },
  bn: { translation: bn },
  ms: { translation: ms },
  tl: { translation: tl },
  sw: { translation: sw },
  ta: { translation: ta },
  te: { translation: te },
  mr: { translation: mr },
} as const;

export type SupportedLanguage = keyof typeof resources;

export const LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "ro", name: "Romanian", nativeName: "Română" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar" },
  { code: "bg", name: "Bulgarian", nativeName: "Български" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "nb", name: "Norwegian", nativeName: "Norsk" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "fi", name: "Finnish", nativeName: "Suomi" },
  { code: "da", name: "Danish", nativeName: "Dansk" },
  { code: "is", name: "Icelandic", nativeName: "Íslenska" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu" },
  { code: "et", name: "Estonian", nativeName: "Eesti" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski" },
  { code: "sr", name: "Serbian", nativeName: "Srpski" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina" },
  { code: "cs", name: "Czech", nativeName: "Čeština" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
  { code: "tl", name: "Filipino", nativeName: "Filipino" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", name: "Marathi", nativeName: "مراठी" },
];

const LANGUAGE_KEY = "wohnly_user_language";

const initI18n = async () => {
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  const deviceLocales = getLocales();
  const deviceLang = deviceLocales[0]?.languageCode || "en";
  
  const SUPPORTED_CODES = Object.keys(resources);
  const initialLang = savedLanguage && SUPPORTED_CODES.includes(savedLanguage)
    ? savedLanguage 
    : (SUPPORTED_CODES.includes(deviceLang) ? deviceLang : "en");

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });
};

initI18n();

export const changeLanguage = async (code: SupportedLanguage) => {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
};

export default i18n;
