interface SkillBarProps {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  color: string;
  accent: string;
  details?: string;
  muted?: boolean;
  auto?: boolean;
  badge?: string;
  floatingLabels?: string[];
  tooltip?: string;
  unlockFadeIn?: boolean;
  accentPct?: number;
  showAccent?: boolean;
  bonusReady?: boolean;
  variant?: "active" | "passive";
  onClick?: () => void;
}

export function SkillBar({
  name,
  level,
  xp,
  xpToNext,
  color,
  accent,
  details,
  muted,
  auto,
  badge,
  floatingLabels,
  tooltip,
  unlockFadeIn,
  accentPct = 0,
  showAccent = false,
  bonusReady = false,
  variant = "active",
  onClick,
}: SkillBarProps) {
  const pct = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
  const isInteractive = Boolean(onClick);

  return (
    <button
      type="button"
      className={`meter-row meter-row-${variant} ${muted ? "is-muted" : ""} ${auto ? "is-auto" : ""} ${bonusReady ? "is-bonus-ready" : ""} ${unlockFadeIn ? "is-unlock-in" : ""} ${!isInteractive ? "is-static" : ""}`}
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
    >
      <div className="meter-headline">
        <span>{name}</span>
        {badge ? <span className="combo-badge">{badge}</span> : null}
      </div>
      {floatingLabels && floatingLabels.length > 0 ? (
        <div className="meter-inline-floats">
          {floatingLabels.map((entry, index) => (
            <div key={`${entry}_${index}`} className="meter-inline-float">
              {entry}
            </div>
          ))}
        </div>
      ) : null}
      <div className="meter-main">
        <div className="meter-frame">
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
            {showAccent ? (
              <div className="meter-accent">
                <div
                  className="meter-accent-fill"
                  style={{ width: `${Math.max(0, Math.min(100, accentPct))}%`, background: accent }}
                />
              </div>
            ) : null}
            <div className="meter-content">
              <div className="meter-primary">
                <span className="meter-level-label">Lvl</span>
                <span className="meter-level">{level}</span>
                <span className="meter-values">
                  {Math.floor(xp)}/{Math.floor(xpToNext)}
                </span>
              </div>
              {details ? <span className="meter-details">{details}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
