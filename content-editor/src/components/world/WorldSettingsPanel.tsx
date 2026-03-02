import { useWorldStore } from "../../stores/worldStore";
import { useItemStore } from "../../stores/itemStore";

export function WorldSettingsPanel() {
  const { world, updateWorld } = useWorldStore();
  const { items } = useItemStore();

  const equippableItems = items.filter((i) => i.slot);
  const startingIds = world.startingItemIds ?? [];

  const toggleStartingItem = (itemId: string) => {
    const next = startingIds.includes(itemId)
      ? startingIds.filter((id) => id !== itemId)
      : [...startingIds, itemId];
    updateWorld({ startingItemIds: next });
  };

  return (
    <section className="editor-section">
      <h3 className="section-title">World Settings</h3>
      <div className="form-grid">
        <div className="form-field">
          <label className="field-label">World Name</label>
          <input
            className="input"
            value={world.name}
            onChange={(e) => updateWorld({ name: e.target.value })}
          />
        </div>
        <div className="form-field">
          <label className="field-label">Starting Room</label>
          <select
            className="input select"
            value={world.startingRoomId}
            onChange={(e) => updateWorld({ startingRoomId: e.target.value })}
          >
            <option value="">-- Select --</option>
            {world.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.gridX},{r.gridY})
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="field-label">Grid Width</label>
          <input
            type="number"
            className="input"
            min={1}
            max={100}
            value={world.gridWidth}
            onChange={(e) =>
              updateWorld({ gridWidth: Math.max(1, Number(e.target.value)) })
            }
          />
        </div>
        <div className="form-field">
          <label className="field-label">Grid Height</label>
          <input
            type="number"
            className="input"
            min={1}
            max={100}
            value={world.gridHeight}
            onChange={(e) =>
              updateWorld({ gridHeight: Math.max(1, Number(e.target.value)) })
            }
          />
        </div>
        <div className="form-field">
          <label className="field-label">Default Slot Count</label>
          <input
            type="number"
            className="input"
            min={1}
            value={world.defaultSlotCount}
            onChange={(e) =>
              updateWorld({
                defaultSlotCount: Math.max(1, Number(e.target.value)),
              })
            }
          />
        </div>
      </div>

      {/* Starting Inventory */}
      <h4 className="section-title" style={{ marginTop: "1.5rem" }}>
        Starting Inventory
      </h4>
      <p className="section-desc">
        Select which equippable items the player starts with. These are
        automatically equipped at game start.
      </p>
      {equippableItems.length === 0 ? (
        <p className="section-desc" style={{ opacity: 0.5 }}>
          No equippable items defined yet.
        </p>
      ) : (
        <div className="tag-list" style={{ gap: "0.5rem" }}>
          {equippableItems.map((item) => {
            const isSelected = startingIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`tag-chip ${isSelected ? "tag-chip--selected" : ""}`}
                onClick={() => toggleStartingItem(item.id)}
                title={`${item.slot} — ${item.name}`}
              >
                <span className="tag-chip-label">
                  {item.name}
                  <span style={{ opacity: 0.5, marginLeft: 6, fontSize: "0.8em" }}>
                    [{item.slot}]
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
