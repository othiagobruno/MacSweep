import {
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from "lucide-react";

interface ActionNoticeProps {
  tone: "success" | "error" | "warning" | "info";
  message: string;
}

const toneConfig: Record<
  ActionNoticeProps["tone"],
  { icon: LucideIcon; className: string }
> = {
  success: { icon: CheckCircle2, className: "success" },
  error: { icon: AlertTriangle, className: "error" },
  warning: { icon: AlertTriangle, className: "warning" },
  info: { icon: Info, className: "info" },
};

export function ActionNotice({ tone, message }: ActionNoticeProps) {
  const { icon: Icon, className } = toneConfig[tone];

  return (
    <div className={`action-notice ${className}`} role="status" aria-live="polite">
      <Icon size={18} />
      <span>{message}</span>
    </div>
  );
}
