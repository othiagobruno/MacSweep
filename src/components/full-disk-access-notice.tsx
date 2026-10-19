import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

export function FullDiskAccessNotice() {
  const { t } = useTranslation();
  return (
    <div className="notice notice-info fade-in">
      <Lock size={18} />
      <div className="notice-body">
        <strong>{t("errors.fullDiskAccess")}</strong>
        <p>{t("errors.fullDiskAccessDesc")}</p>
      </div>
      <button
        className="btn btn-sm btn-secondary"
        onClick={() => void api.shell.openFullDiskAccessSettings()}
      >
        {t("errors.openSettings")}
      </button>
    </div>
  );
}
