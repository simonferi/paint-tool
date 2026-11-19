import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";
import type { en } from "./resources";

export const supportedLanguages = ["en", "sk", "cs", "hu"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
const languageStorageKey = "paint-tool-language";
const storedLanguage = window.localStorage.getItem(languageStorageKey);
const initialLanguage: SupportedLanguage = supportedLanguages.includes(
  storedLanguage as SupportedLanguage,
)
  ? storedLanguage as SupportedLanguage
  : "en";

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: [...supportedLanguages],
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

i18n.on("languageChanged", (language) => {
  const selectedLanguage = supportedLanguages.includes(language as SupportedLanguage)
    ? language
    : "en";
  window.localStorage.setItem(languageStorageKey, selectedLanguage);
  document.documentElement.lang = selectedLanguage;
});

document.documentElement.lang = initialLanguage;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
  }
}

export default i18n;
