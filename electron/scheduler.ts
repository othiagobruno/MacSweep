import { app, Notification } from "electron";
import { scanSystemJunk } from "./services/scanner";
import {
  loadSettings,
  loadStats,
  updateStats,
} from "./services/settings-store";
import type { AppStats } from "../shared/types";

const CHECK_EVERY_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Don't bother the user about less than this. */
const NOTIFY_THRESHOLD = 500 * 1024 * 1024;

const MESSAGES: Record<string, { title: string; body: string }> = {
  en: {
    title: "Time for a cleanup",
    body: "MacSweep found {size} of junk you can safely remove.",
  },
  pt: {
    title: "Hora de uma limpeza",
    body: "O MacSweep encontrou {size} de lixo que pode ser removido com segurança.",
  },
  es: {
    title: "Hora de limpiar",
    body: "MacSweep encontró {size} de basura que puedes eliminar con seguridad.",
  },
  fr: {
    title: "C'est l'heure du ménage",
    body: "MacSweep a trouvé {size} de fichiers inutiles à supprimer en toute sécurité.",
  },
  de: {
    title: "Zeit zum Aufräumen",
    body: "MacSweep hat {size} Datenmüll gefunden, der sicher entfernt werden kann.",
  },
  ja: {
    title: "クリーンアップの時間です",
    body: "MacSweep が安全に削除できる {size} の不要ファイルを見つけました。",
  },
};

function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`;
}

interface SchedulerOptions {
  onOpenSmartScan: () => void;
  onStatsChanged: (stats: AppStats) => void;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function isAutoScanDue(
  intervalDays: number,
  lastScanAt: string | null,
  now = Date.now(),
): boolean {
  if (intervalDays <= 0) return false;
  if (!lastScanAt) return true;
  const last = new Date(lastScanAt).getTime();
  return !Number.isFinite(last) || now - last >= intervalDays * DAY_MS;
}

async function tick(options: SchedulerOptions): Promise<void> {
  if (running) return;
  const settings = loadSettings();
  if (!isAutoScanDue(settings.autoScanInterval, loadStats().lastScanAt)) return;

  running = true;
  try {
    const results = await scanSystemJunk({ ownCacheNames: [app.getName()] });
    const junk = results
      .filter((r) => r.defaultSelected)
      .reduce((sum, r) => sum + r.totalSize, 0);
    options.onStatsChanged(
      updateStats(() => ({
        lastScanAt: new Date().toISOString(),
        lastScanJunkSize: junk,
      })),
    );

    if (
      settings.notifications &&
      junk >= NOTIFY_THRESHOLD &&
      Notification.isSupported()
    ) {
      const msg = MESSAGES[settings.language] ?? MESSAGES.en;
      const notification = new Notification({
        title: msg.title,
        body: msg.body.replace("{size}", formatSize(junk)),
        silent: false,
      });
      notification.on("click", options.onOpenSmartScan);
      notification.show();
    }
  } catch {
    // Background scans are best-effort.
  } finally {
    running = false;
  }
}

export function startScheduler(options: SchedulerOptions): void {
  stopScheduler();
  // Give the app a moment to settle before the first background scan.
  setTimeout(() => void tick(options), 2 * 60 * 1000);
  timer = setInterval(() => void tick(options), CHECK_EVERY_MS);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
