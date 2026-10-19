import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ModuleArt } from "./module-art";
import { PulseLoader } from "./loaders";
import type { Page } from "../types";

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

/**
 * Landing view of a module: headline and benefits on the left, the module
 * illustration on the right and a big round action button below.
 * Texts come from `hero.<page>.*` in the locale files.
 */
export function ScanHero({
  page,
  onScan,
  hint,
  footer,
  label,
}: {
  page: Page;
  onScan: () => void;
  hint?: string;
  footer?: ReactNode;
  label?: string;
}) {
  const { t } = useTranslation();
  const features = [1, 2, 3].map((i) => t(`hero.${page}.f${i}`));

  return (
    <div className="hero fade-in">
      <div className="hero-main">
        <div className="hero-copy">
          <span className="hero-kicker">{t(`hero.${page}.kicker`)}</span>
          <h1 className="hero-title">{t(`hero.${page}.title`)}</h1>
          <p className="hero-subtitle">{t(`hero.${page}.subtitle`)}</p>
          <ul className="hero-features">
            {features.map((feature, i) => (
              <li key={feature} style={{ "--i": i } as React.CSSProperties}>
                <span className="hero-feature-check">
                  <Check size={12} strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="hero-art">
          <ModuleArt page={page} size={250} />
        </div>
      </div>

      <div className="hero-action">
        <button className="round-btn" onClick={onScan}>
          <span>{label ?? t("common.scan")}</span>
        </button>
        {hint && <p className="hero-hint">{hint}</p>}
        {footer}
      </div>
    </div>
  );
}

/** Full-page working state with the animated module illustration. */
export function ScanningState({
  page,
  label,
  progress,
  children,
}: {
  page: Page;
  label: string;
  progress?: number;
  children?: ReactNode;
}) {
  return (
    <div className="working-state fade-in">
      <ModuleArt page={page} size={230} progress={progress} busy>
        {progress !== undefined ? (
          <span className="working-percent">
            {Math.round(progress)}
            <small>%</small>
          </span>
        ) : undefined}
      </ModuleArt>
      <p className="working-label">{label}</p>
      {progress === undefined && <PulseLoader size="sm" />}
      {children}
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
