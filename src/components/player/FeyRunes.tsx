import { useEffect, useState } from "react";
import { useGame } from "../../GameContext";
import { getBundle } from "../../data/loader";
import { buildConsumableDisplayLines } from "../items/consumableDisplay";

const QUICK_SLOT_COUNT = 4;
const SLOT_SIZE = 66;
type QuickSlotIndex = 0 | 1 | 2 | 3;

/**
 * Four clickable quick slots for stackable consumables.
 */
export function FeyRunes() {
  const { state, dispatch } = useGame();
  const bundle = getBundle();

  // Keep cooldown animations ticking.
  const [, setTick] = useState(0);
  useEffect(() => {
    const anyCd = state.quickSlotCooldowns.some((end) => end > state.now);
    if (!anyCd) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [state.quickSlotCooldowns, state.now]);

  return (
    <div className="quick-slots-grid">
      {Array.from({ length: QUICK_SLOT_COUNT }).map((_, index) => {
        const slotIndex = index as QuickSlotIndex;
        const itemId = state.quickSlots[slotIndex];
        const itemDef = itemId ? bundle?.items.find((item) => item.id === itemId) : undefined;
        const inventoryEntry = itemId ? state.inventory.find((item) => item.id === itemId) : undefined;
        const qty = inventoryEntry?.qty ?? 0;
        const consumableLines = buildConsumableDisplayLines(itemDef, bundle);

        const cdEnd = state.quickSlotCooldowns[slotIndex] ?? 0;
        const cdRemainingMs = Math.max(0, cdEnd - state.now);
        const cdTotalMs = itemDef?.quickSlotCooldownMs ?? 0;
        const cdFraction =
          cdRemainingMs > 0 && cdTotalMs > 0
            ? Math.min(1, cdRemainingMs / cdTotalMs)
            : 0;

        const canUse = Boolean(itemDef) && qty > 0 && cdRemainingMs <= 0;
        const isFilled = Boolean(itemDef);

        return (
          <div key={index} className="equipment-cell">
            <span className="slot-label">Slot {slotIndex + 1}</span>
            <div className="quick-slot-wrap">
              <button
                type="button"
                className={`icon-slot icon-slot-equipment quick-slot${isFilled ? " is-filled" : ""}${canUse ? " is-ready" : ""}`}
                style={{
                  width: SLOT_SIZE,
                  height: SLOT_SIZE,
                  backgroundImage: `url("/icons/slots/equipment-shell.png")`,
                }}
                onClick={() => {
                  if (canUse) dispatch({ type: "USE_QUICK_SLOT", slot: slotIndex });
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (itemDef) dispatch({ type: "CLEAR_QUICK_SLOT", slot: slotIndex });
                }}
                aria-label={itemDef ? `${itemDef.name}, x${qty}` : `Quick Slot ${slotIndex + 1}`}
              >
                <span className="icon-slot-content">
                  {itemDef?.image ? (
                    <img className="icon-slot-placeholder" src={itemDef.image} alt={itemDef.name} />
                  ) : itemDef ? (
                    <span className="icon-slot-letter">{itemDef.name[0]?.toUpperCase() ?? "?"}</span>
                  ) : null}
                </span>
                {isFilled && qty > 0 ? <span className="quick-slot-count">x{qty}</span> : null}
                {cdFraction > 0 ? (
                  <span
                    className="quick-slot-cooldown"
                    style={{ height: `${Math.round(cdFraction * 100)}%` }}
                  />
                ) : null}
              </button>

              {itemDef ? (
                <div className="quick-slot-tooltip icon-slot-tooltip" role="tooltip">
                  <div className="icon-slot-tooltip-header">
                    <>
                      {itemDef.image ? (
                        <img className="icon-slot-tooltip-image" src={itemDef.image} alt={itemDef.name} />
                      ) : (
                        <span className="icon-slot-tooltip-letter">{itemDef.name[0]?.toUpperCase() ?? "?"}</span>
                      )}
                    </>
                    <div className="icon-slot-tooltip-heading">
                      <span className={`icon-slot-tooltip-name icon-slot-tooltip-quality-${itemDef.rarity ?? "common"}`}>
                        {itemDef.name}
                      </span>
                      <span className="icon-slot-tooltip-slot">x{qty} available</span>
                    </div>
                  </div>

                  {itemDef.description ? (
                    <p className="icon-slot-tooltip-desc">{itemDef.description}</p>
                  ) : null}

                  {consumableLines.length > 0 ? (
                    <div className="icon-slot-tooltip-stats">
                      {consumableLines.map((line) => (
                        <div key={`${itemDef.id}_${line.label}_${line.value}`} className="icon-slot-tooltip-stat">
                          <span className="icon-slot-tooltip-stat-value">{line.value}</span>
                          <span className="icon-slot-tooltip-stat-label">{line.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <p className="icon-slot-tooltip-tags">Right-click to unbind.</p>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
