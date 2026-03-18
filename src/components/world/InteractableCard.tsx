import type { WorldObject } from "../../state";

interface InteractableCardProps {
  object: WorldObject;
  selected: boolean;
  successChance: number;
  floatingLabels?: string[];
  isHitShaking?: boolean;
  isExtinguishing?: boolean;
  shouldReveal?: boolean;
  revealDelay?: number;
  onClick: () => void;
}

export function InteractableCard({
  object,
  selected,
  successChance,
  floatingLabels,
  isHitShaking,
  isExtinguishing,
  shouldReveal,
  revealDelay,
  onClick,
}: InteractableCardProps) {
  const hasImage = Boolean(object.image);
  const integrityPct = object.maxIntegrity > 0
    ? Math.max(0, Math.min(100, (object.integrity / object.maxIntegrity) * 100))
    : 0;

  return (
    <button
      type="button"
      className={`interactable-card ${selected ? "is-selected" : ""} ${isHitShaking ? "is-hit-shaking" : ""} ${isExtinguishing ? "is-extinguishing" : ""} ${shouldReveal ? "is-reveal-in" : ""}`}
      style={shouldReveal ? { animationDelay: `${revealDelay}ms` } : undefined}
      disabled={isExtinguishing}
      onClick={onClick}
    >
      <div className="interactable-card-header">
        <div
          className="interactable-card-header-fill"
          style={{ width: `${integrityPct}%`, background: object.barColor }}
        />
        <div className="interactable-card-header-content">
          <span className="interactable-card-name">{object.name}</span>
          <span className="interactable-card-hp">
            {Math.ceil(object.integrity)} / {object.maxIntegrity} {object.meterLabel?.toUpperCase() ?? "HP"}
          </span>
          <span className="interactable-card-chance">{successChance}% Success Rate</span>
        </div>
      </div>

      {hasImage && (
        <div
          className="interactable-card-bg"
          style={{ backgroundImage: `url(${object.image})` }}
        />
      )}

      {!hasImage && <div className="interactable-card-empty" />}

      {floatingLabels && floatingLabels.length > 0 && (
        <div className="meter-inline-floats">
          {floatingLabels.map((entry, i) => (
            <div key={`${entry}_${i}`} className="meter-inline-float">{entry}</div>
          ))}
        </div>
      )}
    </button>
  );
}
