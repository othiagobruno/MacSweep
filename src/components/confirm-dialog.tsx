import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "warning" | "danger" | "admin";
  onConfirm: () => void;
  onCancel: () => void;
}

const ICONS = {
  warning: AlertTriangle,
  danger: Trash2,
  admin: ShieldAlert,
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "warning",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Destructive actions default focus to Cancel so Enter can't delete by accident.
    (variant === "danger" ? cancelRef : confirmRef).current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, variant, onCancel]);

  if (!isOpen) return null;
  const Icon = ICONS[variant];

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog fade-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`dialog-icon ${variant === "danger" ? "danger" : "warning"}`}>
          <Icon size={26} />
        </div>
        <h3 id="dialog-title">{title}</h3>
        <div className="dialog-message">{message}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel || t("common.cancel")}
          </button>
          <button
            ref={confirmRef}
            className={`btn ${variant === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel || t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
