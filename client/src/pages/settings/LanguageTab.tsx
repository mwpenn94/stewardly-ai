/**
 * LanguageTab — Language selection in Settings (G31)
 */

import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸", dir: "ltr" as const },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", dir: "ltr" as const },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", dir: "rtl" as const },
] as const;

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export function LanguageTab() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.split("-")[0] || "en";

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    // Set document direction for RTL languages
    const dir = RTL_LANGUAGES.has(code) ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = code;
    toast.success(`Language changed to ${LANGUAGES.find(l => l.code === code)?.name || code}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          {t("settings.language")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.languageDesc")}
        </p>
      </div>

      <div className="grid gap-3">
        {LANGUAGES.map((lang) => (
          <Card
            key={lang.code}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              currentLang === lang.code
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border"
            }`}
            onClick={() => changeLanguage(lang.code)}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <CardTitle className="text-sm font-medium">{lang.nativeName}</CardTitle>
                    <CardDescription className="text-xs">{lang.name}</CardDescription>
                  </div>
                </div>
                {currentLang === lang.code && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("common.comingSoon", "More languages coming soon. Contact us to request a language.")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
