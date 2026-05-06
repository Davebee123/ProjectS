import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SkillPerkMilestone {
  level: number;
  description: string;
}

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
  perkMilestones?: SkillPerkMilestone[];
  unlockFadeIn?: boolean;
  accentPct?: number;
  showAccent?: boolean;
  tickMarkersPct?: number[];
  resolvedTickCount?: number;
  bonusReady?: boolean;
  castComplete?: boolean;
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
  tooltip,
  perkMilestones = [],
  unlockFadeIn,
  accentPct = 0,
  showAccent = false,
  tickMarkersPct = [],
  resolvedTickCount = 0,
  bonusReady = false,
  castComplete = false,
  variant = "active",
  onClick,
}: SkillBarProps) {
  const [displayXp, setDisplayXp] = useState(Math.floor(xp));
  const [isPerkTooltipOpen, setIsPerkTooltipOpen] = useState(false);
  const [perkTooltipStyle, setPerkTooltipStyle] = useState<{
    left: number;
    top: number;
    width: number;
    placement: "above" | "below";
  } | null>(null);
  const previousXpRef = useRef({
    xp: Math.floor(xp),
    level,
    xpToNext,
  });
  const perkTriggerRef = useRef<HTMLSpanElement | null>(null);
  const pct = Math.max(0, Math.min(100, (displayXp / xpToNext) * 100));
  const isInteractive = Boolean(onClick);
  const sortedPerkMilestones = useMemo(
    () => [...perkMilestones].sort((a, b) => a.level - b.level),
    [perkMilestones]
  );
  const hasLevelTooltip = Boolean((tooltip && tooltip.trim()) || sortedPerkMilestones.length > 0);

  useEffect(() => {
    const nextXp = Math.floor(xp);
    const previous = previousXpRef.current;

    if (level !== previous.level || xpToNext !== previous.xpToNext || nextXp <= previous.xp) {
      setDisplayXp(nextXp);
      previousXpRef.current = { xp: nextXp, level, xpToNext };
      return;
    }

    let currentXp = previous.xp;
    const delta = nextXp - previous.xp;
    const stepMs = Math.max(60, Math.min(130, Math.floor(420 / Math.max(1, delta))));
    previousXpRef.current = { xp: nextXp, level, xpToNext };
    setDisplayXp(currentXp);

    const timer = window.setInterval(() => {
      currentXp += 1;
      if (currentXp >= nextXp) {
        currentXp = nextXp;
        window.clearInterval(timer);
      }
      setDisplayXp(currentXp);
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [xp, level, xpToNext]);

  useEffect(() => {
    if (!isPerkTooltipOpen || !hasLevelTooltip) {
      return;
    }

    const updatePerkTooltipPosition = () => {
      const trigger = perkTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 16;
      const gap = 12;
      const milestoneColumns = Math.max(1, sortedPerkMilestones.length);
      const idealWidth =
        milestoneColumns * 198 + Math.max(0, milestoneColumns - 1) * 8;
      const width = Math.min(
        Math.max(260, tooltip ? 320 : 188, sortedPerkMilestones.length > 0 ? idealWidth : 0),
        window.innerWidth - viewportPadding * 2
      );
      const placement = rect.top >= 190 ? "above" : "below";
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding)
      );
      const top = placement === "above" ? rect.top - gap : rect.bottom + gap;
      setPerkTooltipStyle({ left, top, width, placement });
    };

    updatePerkTooltipPosition();
    window.addEventListener("resize", updatePerkTooltipPosition);
    window.addEventListener("scroll", updatePerkTooltipPosition, true);
    return () => {
      window.removeEventListener("resize", updatePerkTooltipPosition);
      window.removeEventListener("scroll", updatePerkTooltipPosition, true);
    };
  }, [hasLevelTooltip, isPerkTooltipOpen, sortedPerkMilestones, tooltip]);

  return (
    <>
      <button
        type="button"
        className={`meter-row meter-row-${variant} ${muted ? "is-muted" : ""} ${auto ? "is-auto" : ""} ${bonusReady ? "is-bonus-ready" : ""} ${castComplete ? "is-cast-complete" : ""} ${unlockFadeIn ? "is-unlock-in" : ""} ${!isInteractive ? "is-static" : ""}`}
        onClick={onClick}
        aria-label={tooltip ? `${name}. ${tooltip}` : name}
      >
        <div className="meter-headline">
          <span>{name}</span>
          {badge ? <span className="combo-badge">{badge}</span> : null}
        </div>
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
              {tickMarkersPct.length > 0 ? (
                <div className="meter-tick-markers" aria-hidden="true">
                  {tickMarkersPct.map((tickPct, index) => (
                    <span
                      key={`${tickPct}_${index}`}
                      className={`meter-tick-marker ${index < resolvedTickCount ? "is-resolved" : ""}`}
                      style={{ left: `${Math.max(0, Math.min(100, tickPct))}%` }}
                    />
                  ))}
                </div>
              ) : null}
              <div className="meter-content">
                <div className="meter-primary">
                  <span
                    ref={perkTriggerRef}
                    className={`meter-level-trigger ${hasLevelTooltip ? "has-perks" : ""}`}
                    onMouseEnter={hasLevelTooltip ? () => setIsPerkTooltipOpen(true) : undefined}
                    onMouseLeave={hasLevelTooltip ? () => setIsPerkTooltipOpen(false) : undefined}
                  >
                    <span className="meter-level-label">Lvl</span>
                    <span className="meter-level">{level}</span>
                  </span>
                  <span className="meter-values">
                    {displayXp}/{Math.floor(xpToNext)}
                  </span>
                </div>
                {details ? <span className="meter-details">{details}</span> : null}
              </div>
            </div>
          </div>
        </div>
      </button>

      {hasLevelTooltip && isPerkTooltipOpen && perkTooltipStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`skill-perk-tooltip is-${perkTooltipStyle.placement}`}
              style={{
                left: perkTooltipStyle.left,
                top: perkTooltipStyle.top,
                width: perkTooltipStyle.width,
              }}
              role="dialog"
              aria-label={`${name} details`}
            >
              <div className="skill-perk-tooltip-header">
                <p className="skill-perk-tooltip-name">{name}</p>
                {tooltip ? <p className="skill-perk-tooltip-description">{tooltip}</p> : null}
              </div>
              {sortedPerkMilestones.length > 0 ? (
                <div
                  className="skill-perk-tooltip-grid"
                  style={{ gridTemplateColumns: `repeat(${sortedPerkMilestones.length}, minmax(0, 1fr))` }}
                >
                  {sortedPerkMilestones.map((milestone) => (
                    <article
                      key={`${name}_${milestone.level}`}
                      className={`skill-perk-card ${level >= milestone.level ? "is-unlocked" : "is-locked"}`}
                      style={level >= milestone.level ? { borderColor: accent } : undefined}
                    >
                      <div className="skill-perk-card-level">
                        <span className="skill-perk-card-level-label">LVL</span>
                        <span className="skill-perk-card-level-value">{milestone.level}</span>
                      </div>
                      <p className="skill-perk-card-description">{milestone.description}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
