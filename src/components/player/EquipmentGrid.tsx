import { useGame } from "../../GameContext";
import { IconSlot } from "../shared/IconSlot";
import { getBundle } from "../../data/loader";
import { resolveEquipmentItem } from "../../data/bridge";
import type { EquipmentSlot } from "../../state";

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  head: "/icons/slots/head.png",
  hands: "/icons/slots/hands.png",
  mainHand: "/icons/slots/mainHand.png",
  shoulders: "/icons/slots/shoulders.png",
  back: "/icons/slots/back.png",
  offHand: "/icons/slots/offHand.png",
  chest: "/icons/slots/chest.png",
  feet: "/icons/slots/feet.png",
  legs: "/icons/slots/legs.png",
};

const SLOT_LAYOUT: { slot: EquipmentSlot; label: string }[][] = [
  [
    { slot: "head", label: "Head" },
    { slot: "hands", label: "Hands" },
    { slot: "mainHand", label: "Main" },
  ],
  [
    { slot: "shoulders", label: "Shld" },
    { slot: "back", label: "Back" },
    { slot: "offHand", label: "Offhand" },
  ],
  [
    { slot: "chest", label: "Chest" },
    { slot: "feet", label: "Feet" },
  ],
  [
    { slot: "legs", label: "Legs" },
  ],
];

export function EquipmentGrid() {
  const { state, dispatch } = useGame();
  const bundle = getBundle();

  return (
    <div className="equipment-grid">
      {SLOT_LAYOUT.map((row, ri) => (
        <div key={ri} className="equipment-row">
          {row.map(({ slot, label }) => {
            const itemId = state.equipment[slot];
            const itemInstance = itemId
              ? state.inventoryEquipment.find((i) => i.instanceId === itemId)
              : undefined;
            const resolved = bundle && itemInstance
              ? resolveEquipmentItem(itemInstance, bundle)
              : undefined;
            return (
              <div key={slot} className="equipment-cell">
                <span className="slot-label">{label}</span>
                <IconSlot
                  label={label}
                  itemName={resolved?.name}
                  icon={SLOT_ICONS[slot]}
                  size={66}
                  variant="equipment"
                  active={Boolean(itemId)}
                  tooltipData={resolved ? {
                    name: resolved.name,
                    description: resolved.description,
                    quality: resolved.quality,
                    image: resolved.image,
                    slot: resolved.slot,
                    modifiers: resolved.modifiers,
                    attackTags: resolved.attackTags,
                  } : undefined}
                  onClick={
                    itemId
                      ? () => dispatch({ type: "UNEQUIP_SLOT", slot })
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
