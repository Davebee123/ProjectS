import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export interface IconSlotTooltipData {
  name: string;
  description?: string;
  quality?: string;
  image?: string;
  slot?: string;
  modifiers?: Array<{ statId: string; operation: string; value: number; scope?: { targetTag?: string } }>;
  attackTags?: string[];
}

interface IconSlotProps {
  label?: string;
  itemName?: string;
  size?: number;
  active?: boolean;
  icon?: string;
  variant?: "equipment" | "backpack";
  tooltipData?: IconSlotTooltipData;
  onClick?: () => void;
}

function humanizeStat(statId: string): string {
  return statId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatModValue(mod: { operation: string; value: number }): string {
  if (mod.operation === "multiply") {
    const pct = Math.round((mod.value - 1) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  }
  return mod.value >= 0 ? `+${mod.value}` : `${mod.value}`;
}

export function IconSlot({
  label,
  itemName,
  size = 36,
  active = false,
  icon,
  variant = "equipment",
  tooltipData,
  onClick,
}: IconSlotProps) {
  const shellImage =
    variant === "backpack"
      ? "/icons/slots/backpack-shell.png"
      : "/icons/slots/equipment-shell.png";

  const [isHovered, setIsHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isHovered || !tooltipData || !ref.current) {
      setTooltipStyle(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 220);
    const top = rect.bottom + 6;
    setTooltipStyle({ left, top });
  }, [isHovered, tooltipData]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`icon-slot icon-slot-${variant} ${active ? "is-active" : ""} ${itemName ? "is-filled" : ""}`}
        style={{ width: size, height: size, backgroundImage: `url("${shellImage}")` }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={!tooltipData ? (itemName ? `${label ? label + ": " : ""}${itemName}` : label ?? "Empty") : undefined}
      >
        <span className="icon-slot-content">
          {itemName ? (
            <span className="icon-slot-letter">{itemName[0].toUpperCase()}</span>
          ) : icon ? (
            <img className="icon-slot-placeholder" src={icon} alt={label ?? ""} />
          ) : null}
        </span>
      </button>

      {isHovered && tooltipData && tooltipStyle
        ? createPortal(
            <div className="icon-slot-tooltip" style={{ left: tooltipStyle.left, top: tooltipStyle.top }}>
              <div className="icon-slot-tooltip-header">
                {tooltipData.image ? (
                  <img className="icon-slot-tooltip-image" src={tooltipData.image} alt={tooltipData.name} />
                ) : (
                  <span className="icon-slot-tooltip-letter">{tooltipData.name[0]?.toUpperCase() ?? "?"}</span>
                )}
                <div className="icon-slot-tooltip-heading">
                  <span className={`icon-slot-tooltip-name icon-slot-tooltip-quality-${tooltipData.quality ?? "common"}`}>{tooltipData.name}</span>
                  {tooltipData.slot ? <span className="icon-slot-tooltip-slot">{humanizeStat(tooltipData.slot)}</span> : null}
                </div>
              </div>
              {tooltipData.modifiers && tooltipData.modifiers.length > 0 ? (
                <div className="icon-slot-tooltip-stats">
                  {tooltipData.modifiers.map((mod, i) => (
                    <div key={i} className="icon-slot-tooltip-stat">
                      <span className="icon-slot-tooltip-stat-value">{formatModValue(mod)}</span>
                      <span className="icon-slot-tooltip-stat-label">
                        {humanizeStat(mod.statId)}
                        {mod.scope?.targetTag ? (
                          <span className="icon-slot-tooltip-stat-scope"> vs {humanizeStat(mod.scope.targetTag)}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {tooltipData.attackTags && tooltipData.attackTags.length > 0 ? (
                <p className="icon-slot-tooltip-tags">
                  Effective vs: {tooltipData.attackTags.map((t) => humanizeStat(t)).join(", ")}
                </p>
              ) : null}
              {tooltipData.description ? (
                <p className="icon-slot-tooltip-desc">{tooltipData.description}</p>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
