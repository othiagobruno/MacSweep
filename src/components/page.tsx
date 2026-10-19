import type { ReactNode } from "react";
import { PulseLoader, ScanningLines } from "./loaders";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header page-header-row">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

/** The big round "Scan" call-to-action shown before a page has results. */
export function ScanHero({
  icon,
  label,
  hint,
  onScan,
  footer,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onScan: () => void;
  footer?: ReactNode;
}) {
  return (
    <div className="scan-container">
      <div className="fade-in scan-hero">
        <div className="scan-circle-wrapper">
          <div className="scan-circle-bg" />
          <button className="scan-btn" onClick={onScan} autoFocus>
            {icon}
            {label}
          </button>
        </div>
        <p className="scan-status">{hint}</p>
        {footer}
      </div>
    </div>
  );
}

export function ScanningState({ label }: { label: string }) {
  return (
    <div className="scan-container fade-in" style={{ minHeight: 300 }}>
      <PulseLoader label={label} size="lg" />
      <ScanningLines />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state fade-in">
      {icon}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="page-actions-bar">
      <div className="toolbar">{children}</div>
    </div>
  );
}
