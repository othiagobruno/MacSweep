import type { ElectronAPI } from "../shared/api";

declare global {
  interface Window {
    /** Undefined when the UI runs in a plain browser (`npm run dev:web`). */
    electronAPI?: ElectronAPI;
  }
}

export type * from "../shared/types";
export type { ElectronAPI, TrayAPI } from "../shared/api";
