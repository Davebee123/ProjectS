import { useGame } from "../../GameContext";
import { IconSlot } from "../shared/IconSlot";

export function FeyRunes() {
  const { state, dispatch } = useGame();

  return (
    <div className="fey-runes-grid">
      {state.feyRunes.map((runeId, index) => {
        const itemName = runeId
          ? state.inventory.find((i) => i.id === runeId)?.name
          : undefined;
        return (
          <IconSlot
            key={index}
            label={`Rune ${index + 1}`}
            size={66}
            itemName={itemName}
            variant="equipment"
            active={Boolean(runeId)}
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
