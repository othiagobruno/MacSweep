import type { FileKind } from "./types";

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  return `${parseFloat(value.toFixed(i === 0 ? 0 : decimals))} ${sizes[i]}`;
}

/** Map our language codes to BCP-47 locales for Intl APIs. */
export function localeFor(language: string): string {
  const map: Record<string, string> = {
    en: "en-US",
    pt: "pt-BR",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    ja: "ja-JP",
  };
  return map[language] ?? language;
}

export function formatDate(isoString: string, language = "en"): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(localeFor(language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(date: Date, language = "en"): string {
  return date.toLocaleTimeString(localeFor(language), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** "3 days ago", "in 2 hours", … in the user's language. */
export function formatRelative(
  isoString: string | null,
  language = "en",
  now = Date.now(),
): string | null {
  if (!isoString) return null;
  const then = new Date(isoString).getTime();
  if (!Number.isFinite(then)) return null;
  const rtf = new Intl.RelativeTimeFormat(localeFor(language), { numeric: "auto" });
  const diffSec = Math.round((then - now) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSec) >= seconds) {
      return rtf.format(Math.round(diffSec / seconds), unit);
    }
  }
  return rtf.format(0, "minute");
}

export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function daysSince(isoString: string | null, now = Date.now()): number | null {
  if (!isoString) return null;
  const then = new Date(isoString).getTime();
  return Number.isFinite(then) ? Math.floor((now - then) / 86_400_000) : null;
}

/** Replace the home folder prefix with "~" for display. */
export function shortenPath(filePath: string): string {
  const match = filePath.match(/^\/Users\/[^/]+(\/.*)?$/);
  return match ? `~${match[1] ?? ""}` : filePath;
}

export const KIND_COLORS: Record<FileKind, string> = {
  video: "#ff7675",
  audio: "#fd79a8",
  image: "#0984e3",
  archive: "#fdcb6e",
  diskImage: "#a29bfe",
  document: "#e17055",
  other: "#8888aa",
};

export function sumBy<T>(list: T[], pick: (item: T) => number): number {
  return list.reduce((sum, item) => sum + pick(item), 0);
}
