// src/i18n.js
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";
import { join } from "path";
import { defaultLang } from "../Cfg.js";

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: defaultLang ?? "en",
    supportedLngs: ["en", "de"],
    preload: ["en", "de"],
    ns: ["common", "forms", "errors", "flash"],
    defaultNS: "common",
    backend: {
      loadPath: join(process.cwd(), "locales/{{lng}}/{{ns}}.json"),
    },
    detection: {
      order: ["cookie", "querystring", "header"],
      caches: ["cookie"],
      cookieName: "locale",
      lookupQuerystring: "lang",
    },
  });

export default i18next;
