interface CircularGaugeProps {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  impactText?: {
    id: string;
    text: string;
  };
  isHitShaking?: boolean;
}

export function CircularGauge({
  value,
  max,
  color,
  size = 112,
  strokeWidth = 7,
  label,
  impactText,
  isHitShaking = false,
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="circular-gauge" style={{ width: size }}>
      <div className={`circular-gauge-face ${isHitShaking ? "is-hit-shaking" : ""}`} style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--gauge-track, rgba(255,255,255,0.08))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
        </svg>
        <div className="circular-gauge-center">
          <span className="circular-gauge-value" style={{ fontSize: size * 0.28 }}>
          {Math.floor(value)}
          </span>
        </div>
        {impactText ? (
          <div key={impactText.id} className="circular-gauge-impact-text">
            {impactText.text}
          </div>
        ) : null}
      </div>
      <div className="circular-gauge-label">{label}</div>
    </div>
  );
}
