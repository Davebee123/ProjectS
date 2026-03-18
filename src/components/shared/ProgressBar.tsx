interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
  height?: number;
  label?: string;
  showValues?: boolean;
}

export function ProgressBar({
  value,
  max,
  color,
  height = 18,
  label,
  showValues = true,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="progress-bar" style={{ height }}>
      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
      <div className="progress-bar-content">
        {label && <span className="progress-bar-label">{label}</span>}
        {showValues && (
          <span className="progress-bar-values">
            {Math.floor(value)}/{Math.floor(max)}
          </span>
        )}
      </div>
    </div>
  );
}
