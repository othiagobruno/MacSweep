/**
 * Loading and scanning animations.
 */

interface ScanningOrbProps {
  progress?: number;
  label?: string;
  sublabel?: string;
  size?: number;
}

export function ScanningOrb({
  progress,
  label,
  sublabel,
  size = 220,
}: ScanningOrbProps) {
  const r = (size - 20) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - ((progress ?? 0) / 100) * circumference;

  return (
    <div className="scanning-orb" style={{ width: size, height: size }}>
      {/* Ambient glow layers */}
      <div className="scanning-orb-glow" />
      <div className="scanning-orb-glow-inner" />

      {/* Rotating ring */}
      <svg className="scanning-orb-ring" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="orbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "var(--accent-primary)" }} />
            <stop offset="50%" style={{ stopColor: "var(--accent-secondary)" }} />
            <stop offset="100%" style={{ stopColor: "var(--accent-primary)" }} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: "color-mix(in srgb, var(--accent-primary) 12%, transparent)" }}
          strokeWidth="3"
        />
        {/* Progress arc */}
        {progress !== undefined && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#orbGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        )}
      </svg>

      {/* Orbiting particles */}
      <div className="scanning-orb-particles">
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
      </div>

      {/* Center content */}
      <div className="scanning-orb-content">
        {progress !== undefined ? (
          <span className="scanning-orb-percent">
            {Math.round(progress)}
            <small>%</small>
          </span>
        ) : (
          <span className="scanning-orb-label-main">{label || "Scan"}</span>
        )}
        {sublabel && <span className="scanning-orb-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}

interface PulseLoaderProps {
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function PulseLoader({ label, size = "md" }: PulseLoaderProps) {
  const dotSize = size === "sm" ? 6 : size === "md" ? 8 : 10;
  const gap = size === "sm" ? 4 : size === "md" ? 6 : 8;

  return (
    <div className="pulse-loader">
      <div className="pulse-loader-dots" style={{ gap }}>
        <div
          className="pulse-dot"
          style={{
            width: dotSize,
            height: dotSize,
            animationDelay: "0s",
          }}
        />
        <div
          className="pulse-dot"
          style={{
            width: dotSize,
            height: dotSize,
            animationDelay: "0.15s",
          }}
        />
        <div
          className="pulse-dot"
          style={{
            width: dotSize,
            height: dotSize,
            animationDelay: "0.3s",
          }}
        />
      </div>
      {label && <span className="pulse-loader-label">{label}</span>}
    </div>
  );
}

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
}

export function Skeleton({
  width = "100%",
  height = 20,
  radius = "var(--radius-md)",
}: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
      }}
    />
  );
}

export function ScanningLines() {
  return (
    <div className="scanning-lines">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="scanning-line"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}
