// DIM's boots i18next and pulls a catalogue over HTTP

export type DimLanguage = "en";

export const DIM_LANGS: DimLanguage[] = ["en"];

export const DIM_LANG_INFOS = {
  en: { pluralOverride: false, latinBased: true },
} as const;

export const defaultLanguage = (): DimLanguage => "en";
