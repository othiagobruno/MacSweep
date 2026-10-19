/**
 * Loading and scanning animations.
 */

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
