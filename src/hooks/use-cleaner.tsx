import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../components/confirm-dialog";
import { api } from "../lib/api";
import { requestDiskRefresh } from "../lib/events";

export interface CleanOutcome {
  freed: number;
  failed: string[];
}

/**
 * Deletes paths and, when some are protected, offers to retry them with
 * administrator privileges. Render `dialog` somewhere in the page.
 */
export function useCleaner() {
  const { t } = useTranslation();
  const [isCleaning, setIsCleaning] = useState(false);
  const [adminCount, setAdminCount] = useState(0);
  const resolver = useRef<((retry: boolean) => void) | null>(null);

  const askForAdmin = (count: number) =>
    new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setAdminCount(count);
    });

  const answer = (retry: boolean) => {
    resolver.current?.(retry);
    resolver.current = null;
    setAdminCount(0);
  };

  const clean = useCallback(async (paths: string[]): Promise<CleanOutcome> => {
    setIsCleaning(true);
    try {
      const result = await api.clean.files(paths);
      let freed = result.freedSpace;
      let failed = result.failedPaths;

      if (
        result.needsAdminPaths.length > 0 &&
        (await askForAdmin(result.needsAdminPaths.length))
      ) {
        const adminResult = await api.clean.filesAsAdmin(
          result.needsAdminPaths,
        );
        freed += adminResult.freedSpace;
        const retried = new Set(result.needsAdminPaths);
        failed = [
          ...failed.filter((p) => !retried.has(p)),
          ...adminResult.failedPaths,
        ];
      }
      return { freed, failed };
    } finally {
      setIsCleaning(false);
      requestDiskRefresh();
    }
  }, []);

  const dialog = (
    <ConfirmDialog
      isOpen={adminCount > 0}
      variant="admin"
      title={t("admin.retryTitle")}
      message={t("admin.retryMessage", { count: adminCount })}
      confirmLabel={t("admin.retryConfirm")}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );

  return { clean, isCleaning, dialog };
}
