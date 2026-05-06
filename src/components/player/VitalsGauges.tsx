import { useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../../GameContext";
import { getBundle } from "../../data/loader";
import { CircularGauge } from "../shared/CircularGauge";

function humanizeStat(stat: string): string {
  return stat
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ResolvedPlayerEffect {
  effectId: string;
  name: string;
  description: string;
  color: string;
  iconImage?: string;
  stacks: number;
  remainingMs?: number;
  progressPct?: number;
  statModifiers: Array<{
    stat: string;
    operation: "add" | "multiply";
    value: number;
    skillIds?: string[];
    abilityTags?: string[];
  }>;
}

function PlayerStatusBadge({ effect }: { effect: ResolvedPlayerEffect }) {
  const [hovered, setHovered] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const TOOLTIP_WIDTH = 240;
  const VIEWPORT_PADDING = 12;
  const ESTIMATED_TOOLTIP_HEIGHT = 190;

  const tooltipPos = useMemo(() => {
    if (!hovered || !badgeRef.current) return null;
    const rect = badgeRef.current.getBoundingClientRect();
    const centeredLeft = rect.left + rect.width / 2;
    const clampedLeft = Math.max(
      VIEWPORT_PADDING + TOOLTIP_WIDTH / 2,
      Math.min(window.innerWidth - VIEWPORT_PADDING - TOOLTIP_WIDTH / 2, centeredLeft)
    );
    const showAbove = rect.bottom + 10 + ESTIMATED_TOOLTIP_HEIGHT > window.innerHeight - VIEWPORT_PADDING;
    const rawTop = showAbove ? rect.top - 8 : rect.bottom + 8;
    const clampedTop = showAbove
      ? Math.max(VIEWPORT_PADDING + ESTIMATED_TOOLTIP_HEIGHT, rawTop)
      : Math.min(window.innerHeight - VIEWPORT_PADDING - ESTIMATED_TOOLTIP_HEIGHT, rawTop);
    return {
      top: clampedTop,
      left: clampedLeft,
      placement: showAbove ? "above" : "below",
    };
  }, [hovered]);

  return (
    <>
      <div
        ref={badgeRef}
        className="player-status-badge"
        style={{ backgroundImage: "url(/explore-button-new.png)" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="interactable-status-badge-shell">
          <div
            className="interactable-status-badge-icon"
            style={
              effect.iconImage
                ? { backgroundImage: `url(${effect.iconImage})` }
                : { color: effect.color }
            }
          >
            {!effect.iconImage ? effect.name.slice(0, 2).toUpperCase() : null}
          </div>
          {effect.progressPct !== undefined ? (
            <div
              className="interactable-status-badge-cooldown"
              style={{
                transform: `scaleY(${Math.max(0, Math.min(100, effect.progressPct)) / 100})`,
              }}
            />
          ) : null}
          {effect.remainingMs !== undefined ? (
            <div className="interactable-status-badge-timer">
              {effect.remainingMs >= 10000
                ? `${Math.ceil(effect.remainingMs / 1000)}`
                : (effect.remainingMs / 1000).toFixed(1)}
            </div>
          ) : null}
          {effect.stacks > 1 ? (
            <div className="interactable-status-badge-stacks">{effect.stacks}</div>
          ) : null}
        </div>
      </div>

      {hovered && tooltipPos
        ? createPortal(
            <div
              className="player-status-tooltip"
              data-placement={tooltipPos.placement}
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                transform: tooltipPos.placement === "above" ? "translate(-50%, -100%)" : "translateX(-50%)",
              }}
            >
              <p className="player-status-tooltip-name" style={{ color: effect.color }}>
                {effect.name}
              </p>
              {effect.stacks > 1 ? (
                <p className="player-status-tooltip-stacks">×{effect.stacks} stacks</p>
              ) : null}
              {effect.description ? (
                <p className="player-status-tooltip-desc">{effect.description}</p>
              ) : null}
              {effect.statModifiers.length > 0 ? (
                <div className="player-status-tooltip-mods">
                  {effect.statModifiers.map((mod, i) => {
                    const perStack =
                      mod.operation === "add"
                        ? `${mod.value >= 0 ? "+" : ""}${mod.value}`
                        : `×${mod.value}`;
                    const total =
                      effect.stacks > 1
                        ? mod.operation === "add"
                          ? ` (${mod.value * effect.stacks >= 0 ? "+" : ""}${mod.value * effect.stacks})`
                          : ` (×${Math.pow(mod.value, effect.stacks).toFixed(2)})`
                        : "";
                    return (
                      <p key={i} className="player-status-tooltip-mod">
                        {humanizeStat(mod.stat)}: {perStack}{total}
                        {mod.skillIds?.length || mod.abilityTags?.length
                          ? ` (${[
                              mod.skillIds?.length ? `skills: ${mod.skillIds.join(", ")}` : "",
                              mod.abilityTags?.length ? `ability tags: ${mod.abilityTags.join(", ")}` : "",
                            ]
                              .filter(Boolean)
                              .join(" | ")})`
                          : ""}
                      </p>
                    );
                  })}
                </div>
              ) : null}
              {effect.remainingMs !== undefined ? (
                <p className="player-status-tooltip-time">
                  {effect.remainingMs >= 1000
                    ? `${(effect.remainingMs / 1000).toFixed(1)}s remaining`
                    : "Expiring…"}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function VitalsGauges() {
  const { state } = useGame();
  const bundle = getBundle();

  const playerEffects: ResolvedPlayerEffect[] = useMemo(() => {
    if (!bundle) return [];
    return state.activeEffects.map((active) => {
      const def = bundle.statusEffects?.find((s) => s.id === active.effectId);
      const durationMs = def?.durationMs;
      const elapsedMs = state.now - active.appliedAt;
      const remainingMs =
        durationMs !== undefined ? Math.max(0, durationMs - elapsedMs) : undefined;
      const progressPct =
        durationMs && durationMs > 0
          ? Math.max(0, Math.min(100, (remainingMs! / durationMs) * 100))
          : undefined;
      return {
        effectId: active.effectId,
        name: def?.name ?? active.effectId,
        description: def?.description ?? "",
        color: def?.color ?? "#ffffff",
        iconImage: def?.iconImage,
        stacks: active.stacks,
        remainingMs,
        progressPct,
        statModifiers: def?.statModifiers ?? [],
      };
    });
  }, [state.activeEffects, state.now, bundle]);

  return (
    <>
      <div className="status-effects-section">
        <div className="section-header-bar">
          <p className="section-label">Status Effects</p>
        </div>
        <div className="section-divider-body">
          <div className="player-status-row">
            <div className="player-status-strip">
              {playerEffects.length > 0 ? (
                playerEffects.slice(0, 12).map((effect) => (
                  <PlayerStatusBadge key={effect.effectId} effect={effect} />
                ))
              ) : (
                <p className="player-status-empty">No active status effects.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="vitals-section">
        <div className="section-header-bar">
          <p className="section-label">Vitals</p>
        </div>
        <div className="section-divider-body">
          <div className="vitals-row">
            <CircularGauge
              value={state.health}
              max={state.maxHealth}
              color="var(--health-color, #e05050)"
              label="Health"
              impactText={state.playerHitCue ? { id: state.playerHitCue.id, text: state.playerHitCue.text } : undefined}
              isHitShaking={state.playerHitShakeUntil > state.now}
            />
            <CircularGauge
              value={state.mana}
              max={state.maxMana}
              color="var(--mana-color, #5090e0)"
              label="Mana"
            />
            <CircularGauge
              value={state.energy}
              max={state.maxEnergy}
              color="var(--energy-color, #e0a030)"
              label="Energy"
            />
          </div>
        </div>
      </div>
    </>
  );
}
