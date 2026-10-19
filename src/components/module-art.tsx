import type { Page } from "../types";
import { MODULES } from "../lib/modules";

interface ModuleArtProps {
  page: Page;
  size?: number;
  /** 0–100; when set, a progress ring is drawn around the sphere. */
  progress?: number;
  /** Faster spin and pulse while work is in progress. */
  busy?: boolean;
  children?: React.ReactNode;
}

/**
 * The module "illustration": a glossy floating sphere with the module icon,
 * a slowly rotating halo ring and orbiting particles. Pure CSS/SVG, so it
 * follows the module colors and costs nothing to ship.
 */
export function ModuleArt({
  page,
  size = 240,
  progress,
  busy,
  children,
}: ModuleArtProps) {
  const Icon = MODULES[page].icon;
  const r = size / 2 - 6;
  const circumference = 2 * Math.PI * r;

  return (
    <div
      className={`module-art ${busy ? "busy" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="module-art-halo" />
      <div className="module-art-ring" />
      {progress !== undefined && (
        <svg className="module-art-progress" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} className="track" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="bar"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (progress / 100) * circumference}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
      )}
      <div className="module-art-orbit">
        <span />
        <span />
        <span />
      </div>
      <div className="module-art-sphere">
        <div className="module-art-shine" />
        {children ?? <Icon size={size * 0.3} strokeWidth={1.6} />}
      </div>
    </div>
  );
}
