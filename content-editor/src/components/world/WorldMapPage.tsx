import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useWorldStore, createDefaultRoom } from "../../stores/worldStore";
import { WorldSettingsPanel } from "./WorldSettingsPanel";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function WorldMapPage() {
  const { world, addRoom, removeRoom } = useWorldStore();
  const navigate = useNavigate();
  const [viewSize, setViewSize] = useState(10); // visible grid size
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Build a lookup: "x,y" → room
  const roomGrid = new Map(
    world.rooms.map((r) => [`${r.gridX},${r.gridY}`, r])
  );

  const handleCellClick = (x: number, y: number) => {
    const existing = roomGrid.get(`${x},${y}`);
    if (existing) {
      navigate(`/world/rooms/${existing.id}`);
    } else {
      const name = `Room (${x}, ${y})`;
      const id = slugify(name);
      // Avoid duplicate IDs
      if (world.rooms.some((r) => r.id === id)) return;
      addRoom(createDefaultRoom(id, name, x, y, world.defaultSlotCount));
      navigate(`/world/rooms/${id}`);
    }
  };

  const visibleW = Math.min(viewSize, world.gridWidth - offsetX);
  const visibleH = Math.min(viewSize, world.gridHeight - offsetY);

  return (
    <PageShell title="World Map">
      <WorldSettingsPanel />

      <section className="editor-section">
        <h3 className="section-title">Grid</h3>
        <p className="section-desc">
          Click an empty cell to create a room. Click an existing room to edit
          it. Use the viewport controls to navigate the grid.
        </p>

        {/* Viewport controls */}
        <div className="grid-controls">
          <label className="field-label" style={{ marginRight: 8 }}>
            View size
          </label>
          <input
            type="number"
            className="input input--sm"
            min={3}
            max={Math.max(world.gridWidth, world.gridHeight)}
            value={viewSize}
            onChange={(e) => setViewSize(Math.max(3, Number(e.target.value)))}
          />
          <label className="field-label" style={{ margin: "0 8px" }}>
            Offset X
          </label>
          <input
            type="number"
            className="input input--sm"
            min={0}
            max={Math.max(0, world.gridWidth - viewSize)}
            value={offsetX}
            onChange={(e) =>
              setOffsetX(
                Math.max(
                  0,
                  Math.min(Number(e.target.value), world.gridWidth - viewSize)
                )
              )
            }
          />
          <label className="field-label" style={{ margin: "0 8px" }}>
            Y
          </label>
          <input
            type="number"
            className="input input--sm"
            min={0}
            max={Math.max(0, world.gridHeight - viewSize)}
            value={offsetY}
            onChange={(e) =>
              setOffsetY(
                Math.max(
                  0,
                  Math.min(Number(e.target.value), world.gridHeight - viewSize)
                )
              )
            }
          />
        </div>

        {/* Grid */}
        <div className="world-grid" style={{ gridTemplateColumns: `repeat(${visibleW}, 1fr)` }}>
          {Array.from({ length: visibleH }, (_, row) =>
            Array.from({ length: visibleW }, (_, col) => {
              const x = offsetX + col;
              const y = offsetY + row;
              const room = roomGrid.get(`${x},${y}`);
              const isStart = room?.id === world.startingRoomId;
              return (
                <button
                  key={`${x},${y}`}
                  className={`grid-cell${room ? " grid-cell--filled" : ""}${isStart ? " grid-cell--start" : ""}`}
                  onClick={() => handleCellClick(x, y)}
                  title={
                    room
                      ? `${room.name} (${x},${y})${isStart ? " — START" : ""}`
                      : `Empty (${x},${y}) — click to create`
                  }
                >
                  {room ? (
                    <span className="grid-cell-label">{room.name}</span>
                  ) : (
                    <span className="grid-cell-coord">
                      {x},{y}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Room list (for quick access) */}
      {world.rooms.length > 0 && (
        <section className="editor-section">
          <h3 className="section-title">All Rooms ({world.rooms.length})</h3>
          <table className="editor-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Position</th>
                <th>Slots</th>
                <th>Spawns</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {world.rooms.map((room) => (
                <tr key={room.id}>
                  <td className="cell-id">{room.id}</td>
                  <td>
                    <button
                      className="link-btn"
                      onClick={() => navigate(`/world/rooms/${room.id}`)}
                    >
                      {room.name}
                      {room.id === world.startingRoomId && " (Start)"}
                    </button>
                  </td>
                  <td>
                    ({room.gridX}, {room.gridY})
                  </td>
                  <td>{room.slotCount}</td>
                  <td>{room.spawnTable.length}</td>
                  <td>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => removeRoom(room.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </PageShell>
  );
}
