export const DISK_REFRESH_EVENT = "macsweep:disk-usage-refresh";

/** Ask the shell to refresh the free-space indicator (e.g. after cleaning). */
export function requestDiskRefresh() {
  window.dispatchEvent(new Event(DISK_REFRESH_EVENT));
}
