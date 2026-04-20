import { useGame } from "../../GameContext";
import { getBundle } from "../../data/loader";
import { resolveEquipmentItem } from "../../data/bridge";
import { IconSlot } from "../shared/IconSlot";

export function FeyRunes() {
  const { state, dispatch } = useGame();
  const bundle = getBundle();

  return (
    <div className="fey-runes-grid">
      {state.feyRunes.map((runeId, index) => {
        const itemInstance = runeId
          ? state.inventoryEquipment.find((i) => i.instanceId === runeId)
          : undefined;
        const resolved = bundle && itemInstance
          ? resolveEquipmentItem(itemInstance, bundle)
          : undefined;
        return (
          <IconSlot
            key={index}
            label={`Rune ${index + 1}`}
            size={66}
            itemName={resolved?.name}
            variant="equipment"
            active={Boolean(runeId)}
            tooltipData={resolved ? {
              name: resolved.name,
              description: resolved.description,
              quality: resolved.quality,
              image: resolved.image,
              slot: resolved.slot,
              modifiers: resolved.modifiers,
            } : undefined}
            onClick={
              runeId
                ? () => dispatch({ type: "REMOVE_RUNE", slot: index as 0 | 1 | 2 | 3 | 4 | 5 })
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
