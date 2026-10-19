import type { ElectronAPI } from "../../shared/api";
import { createMockApi } from "./mock-api";

/** True when running inside Electron with the real preload bridge. */
export const isElectron = typeof window !== "undefined" && !!window.electronAPI;

/**
 * The bridge to the main process. Outside Electron (e.g. `npm run dev:web`)
 * a realistic in-memory mock is used so the UI can be developed in a browser.
 */
export const api: ElectronAPI = window.electronAPI ?? createMockApi();

// Lets CSS know it can rely on native window vibrancy behind the sidebar.
if (isElectron) document.documentElement.classList.add("is-electron");
