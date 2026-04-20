import { useWorldStore } from "../../stores/worldStore";
import { useItemStore } from "../../stores/itemStore";
import { useItemizationStore } from "../../stores/itemizationStore";
import { useCutsceneStore } from "../../stores/cutsceneStore";

export function WorldSettingsPanel() {
  const { world, updateWorld } = useWorldStore();
  const { items } = useItemStore();
  const { itemBases } = useItemizationStore();
  const { cutscenes } = useCutsceneStore();

  const startingItemIds = world.startingItemIds ?? [];
  const startingEquipmentBaseIds = world.startingEquipmentBaseIds ?? [];
  const startingItems = items.filter((item) => item.stackable || !item.slot);
  const equippableBases = itemBases.filter((itemBase) => itemBase.slot);

  const toggleStartingItem = (itemId: string) => {
    const next = startingItemIds.includes(itemId)
      ? startingItemIds.filter((id) => id !== itemId)
      : [...startingItemIds, itemId];
    updateWorld({ startingItemIds: next });
  };

  const toggleStartingEquipmentBase = (baseId: string) => {
    const next = startingEquipmentBaseIds.includes(baseId)
      ? startingEquipmentBaseIds.filter((id) => id !== baseId)
      : [...startingEquipmentBaseIds, baseId];
    updateWorld({ startingEquipmentBaseIds: next });
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
            {world.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.gridX},{room.gridY})
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
            onChange={(e) => updateWorld({ gridWidth: Math.max(1, Number(e.target.value)) })}
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
            onChange={(e) => updateWorld({ gridHeight: Math.max(1, Number(e.target.value)) })}
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
        <div className="form-field">
          <label className="field-label">Starting Cutscene</label>
          <select
            className="input select"
            value={world.startingCutsceneId || ""}
            onChange={(e) => updateWorld({ startingCutsceneId: e.target.value || undefined })}
          >
            <option value="">-- None --</option>
            {cutscenes.map((cutscene) => (
              <option key={cutscene.id} value={cutscene.id}>
                {cutscene.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h4 className="section-title" style={{ marginTop: "1.5rem" }}>
        Starting Inventory
      </h4>
      <p className="section-desc">
        Select stackable or static items granted to the player immediately on a new run.
      </p>
      {startingItems.length === 0 ? (
        <p className="section-desc" style={{ opacity: 0.5 }}>
          No starting inventory items are available yet.
        </p>
      ) : (
        <div className="tag-list" style={{ gap: "0.5rem" }}>
          {startingItems.map((item) => {
            const isSelected = startingItemIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`tag-chip ${isSelected ? "tag-chip--selected" : ""}`}
                onClick={() => toggleStartingItem(item.id)}
                title={item.name}
              >
                <span className="tag-chip-label">{item.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <h4 className="section-title" style={{ marginTop: "1.5rem" }}>
        Starting Equipment Bases
      </h4>
      <p className="section-desc">
        Select equipment bases that should be instantiated and auto-equipped at the start of a run.
      </p>
      {equippableBases.length === 0 ? (
        <p className="section-desc" style={{ opacity: 0.5 }}>
          No item bases are available yet.
        </p>
      ) : (
        <div className="tag-list" style={{ gap: "0.5rem" }}>
          {equippableBases.map((itemBase) => {
            const isSelected = startingEquipmentBaseIds.includes(itemBase.id);
            return (
              <button
                key={itemBase.id}
                type="button"
                className={`tag-chip ${isSelected ? "tag-chip--selected" : ""}`}
                onClick={() => toggleStartingEquipmentBase(itemBase.id)}
                title={`${itemBase.slot} - ${itemBase.name}`}
              >
                <span className="tag-chip-label">
                  {itemBase.name}
                  <span style={{ opacity: 0.5, marginLeft: 6, fontSize: "0.8em" }}>
                    [{itemBase.slot}]
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
