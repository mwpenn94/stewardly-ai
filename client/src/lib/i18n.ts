/**
 * i18n configuration (G31)
 *
 * Uses i18next + react-i18next with browser language detection.
 * English is the fallback language. Translation keys are organized
 * by namespace (common, chat, nav, settings, etc.).
 *
 * To add a new language:
 * 1. Create a translation file in client/src/locales/{lang}/
 * 2. Import and add it to the resources object below
 * 3. The language will be auto-detected or selectable in Settings
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// ── English translations (base language) ──────────────────────
import en from "@/locales/en";
import es from "@/locales/es";
import ar from "@/locales/ar";

const resources = {
  en: { translation: en },
  es: { translation: es },
  ar: { translation: ar },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    // Don't load missing keys from backend
    saveMissing: false,
    // Return key as fallback (useful during development)
    returnNull: false,
  });

export default i18n;
