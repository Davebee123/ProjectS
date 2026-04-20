import { createDefaultRoom, useWorldStore } from "../../stores/worldStore";
import { ConditionEditor } from "../shared/ConditionEditor";
import { ReferencePicker } from "../shared/ReferencePicker";
import type { RoomConnection } from "../../schema/types";
import { createUniqueId } from "../../utils/ids";

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
  const { world, addRoom } = useWorldStore();
  const currentRoom = world.rooms.find((room) => room.id === currentRoomId);
  const otherRooms = world.rooms.filter((r) => r.id !== currentRoomId);
  const roomOptions = otherRooms.map((room) => ({
    id: room.id,
    label: room.name,
    meta: `(${room.gridX}, ${room.gridY})${room.level ? ` • Level ${room.level}` : ""}`,
  }));

  const createAndLinkRoom = (name: string) => {
    const id = createUniqueId(name, world.rooms.map((room) => room.id));
    const occupied = new Set(world.rooms.map((room) => `${room.gridX},${room.gridY}`));
    let gridX = currentRoom?.gridX ?? 0;
    let gridY = currentRoom?.gridY ?? 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let y = 0; y < world.gridHeight; y += 1) {
      for (let x = 0; x < world.gridWidth; x += 1) {
        if (occupied.has(`${x},${y}`)) {
          continue;
        }
        const distance = Math.abs(x - (currentRoom?.gridX ?? 0)) + Math.abs(y - (currentRoom?.gridY ?? 0));
        if (distance < bestDistance) {
          bestDistance = distance;
          gridX = x;
          gridY = y;
        }
      }
    }

    addRoom(createDefaultRoom(id, name, gridX, gridY, world.defaultSlotCount));
    return id;
  };

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
              <ReferencePicker
                label="Target Room"
                value={conn.targetRoomId}
                options={roomOptions}
                onChange={(value) => update(idx, { targetRoomId: value })}
                onCreate={createAndLinkRoom}
                createPlaceholder="New room name..."
              />
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
