import { useWorldStore } from "../../stores/worldStore";
import { ConditionEditor } from "../shared/ConditionEditor";
import type { RoomConnection } from "../../schema/types";

interface Props {
  connections: RoomConnection[];
  currentRoomId: string;
  onChange: (connections: RoomConnection[]) => void;
}

export function RoomConnectionsPanel({
  connections,
  currentRoomId,
  onChange,
}: Props) {
  const { world } = useWorldStore();
  const otherRooms = world.rooms.filter((r) => r.id !== currentRoomId);

  const add = () => {
    onChange([...connections, { targetRoomId: "", label: "" }]);
  };

  const update = (idx: number, patch: Partial<RoomConnection>) => {
    const updated = [...connections];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) =>
    onChange(connections.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">Special Connections</h3>
      <p className="section-desc">
        Connections beyond grid adjacency — portals, cave entrances, shortcuts.
        Players can travel to these rooms in addition to adjacent grid cells.
      </p>

      {connections.map((conn, idx) => (
        <div key={idx} className="hook-card">
          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Target Room</label>
              <select
                className="input select"
                value={conn.targetRoomId}
                onChange={(e) =>
                  update(idx, { targetRoomId: e.target.value })
                }
              >
                <option value="">-- Select room --</option>
                {otherRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.gridX},{r.gridY})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Label</label>
              <input
                className="input"
                value={conn.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder='e.g. "Cave Entrance"'
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="field-label">Condition (optional)</label>
              <ConditionEditor
                value={conn.condition || ""}
                onChange={(v) =>
                  update(idx, { condition: v || undefined })
                }
                placeholder="Access condition..."
              />
            </div>
          </div>
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <button
              className="btn btn--danger btn--sm"
              onClick={() => remove(idx)}
            >
              Remove Connection
            </button>
          </div>
        </div>
      ))}

      <button className="btn btn--sm" onClick={add}>
        + Add Connection
      </button>
    </section>
  );
}
