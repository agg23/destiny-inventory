// DIM's version boots i18next and fetches a catalog over HTTP

export type DimLanguage = "en";

export const DIM_LANGS: DimLanguage[] = ["en"];

export const DIM_LANG_INFOS = {
  en: { pluralOverride: false, latinBased: true },
} as const;

export const defaultLanguage = (): DimLanguage => "en";
