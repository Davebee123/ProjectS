import { useGame } from "../../GameContext";
import { IconSlot } from "../shared/IconSlot";

const COLS = 7;
const PAGE_SIZE = 16;

export function BackpackGrid() {
  const { state, dispatch } = useGame();
  const totalPages = Math.max(1, Math.ceil(state.backpackSlots / PAGE_SIZE));
  const pageStart = state.backpackPage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, state.backpackSlots);
  const slotsOnPage = pageEnd - pageStart;

  const slotItems: (typeof state.inventory[number] | null)[] = [];
  for (let i = 0; i < slotsOnPage; i++) {
    const globalIndex = pageStart + i;
    slotItems.push(globalIndex < state.inventory.length ? state.inventory[globalIndex] : null);
  }

  return (
    <div className="backpack-section">
      <p className="section-label">Backpack</p>
      <div className="section-divider-body">
        <div
          className="backpack-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 40px)`,
            gap: 10,
          }}
        >
          {slotItems.map((item, i) => (
            <IconSlot
              key={i}
              itemName={item?.name}
              size={40}
              variant="backpack"
              active={Boolean(item)}
            />
          ))}
        </div>
        {totalPages > 1 && (
          <div className="backpack-nav">
            <button
              type="button"
              className="backpack-nav-btn"
              disabled={state.backpackPage <= 0}
              onClick={() => dispatch({ type: "SET_BACKPACK_PAGE", page: state.backpackPage - 1 })}
            >
              {"\u25C0"}
            </button>
            <div className="backpack-dots">
              {Array.from({ length: totalPages }, (_, i) => (
                <span
                  key={i}
                  className={`backpack-dot ${i === state.backpackPage ? "is-active" : ""}`}
                  onClick={() => dispatch({ type: "SET_BACKPACK_PAGE", page: i })}
                />
              ))}
            </div>
            <button
              type="button"
              className="backpack-nav-btn"
              disabled={state.backpackPage >= totalPages - 1}
              onClick={() => dispatch({ type: "SET_BACKPACK_PAGE", page: state.backpackPage + 1 })}
            >
              {"\u25B6"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
