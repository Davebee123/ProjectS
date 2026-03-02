import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useWorldStore } from "../../stores/worldStore";
import { ConditionEditor } from "../shared/ConditionEditor";
import { SpawnTablePanel } from "./SpawnTablePanel";
import { FixedInteractablesPanel } from "./FixedInteractablesPanel";
import { RoomConnectionsPanel } from "./RoomConnectionsPanel";
import { SeedOverridesPanel } from "./SeedOverridesPanel";

export function RoomEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { world, updateRoom, updateWorld } = useWorldStore();
  const room = world.rooms.find((r) => r.id === id);

  if (!room) {
    return (
      <PageShell title="Room Not Found">
        <p>No room with id "{id}".</p>
        <button className="btn" onClick={() => navigate("/world")}>
          Back to World Map
        </button>
      </PageShell>
    );
  }

  const update = (patch: Partial<typeof room>) => updateRoom(room.id, patch);
  const isStart = world.startingRoomId === room.id;

  return (
    <PageShell
      title={room.name}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          {!isStart && (
            <button
              className="btn btn--primary"
              onClick={() => updateWorld({ startingRoomId: room.id })}
            >
              Set as Start
            </button>
          )}
          <button className="btn" onClick={() => navigate("/world")}>
            Back to World Map
          </button>
        </div>
      }
    >
      {/* ── Basic Properties ── */}
      <section className="editor-section">
        <h3 className="section-title">
          Basic Properties
          {isStart && (
            <span className="kind-badge kind-badge--active" style={{ marginLeft: 8 }}>
              Starting Room
            </span>
          )}
        </h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="field-label">ID</label>
            <input className="input" value={room.id} disabled />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              className="input"
              value={room.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div className="form-field form-field--wide">
            <label className="field-label">Description</label>
            <input
              className="input"
              value={room.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What the player sees when entering..."
            />
          </div>
          <div className="form-field">
            <label className="field-label">Grid X</label>
            <input
              type="number"
              className="input"
              value={room.gridX}
              onChange={(e) => update({ gridX: Number(e.target.value) })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Grid Y</label>
            <input
              type="number"
              className="input"
              value={room.gridY}
              onChange={(e) => update({ gridY: Number(e.target.value) })}
            />
          </div>
          <div className="form-field">
            <label className="field-label">Slot Count</label>
            <input
              type="number"
              className="input"
              min={1}
              value={room.slotCount}
              onChange={(e) =>
                update({ slotCount: Math.max(1, Number(e.target.value)) })
              }
            />
          </div>
        </div>
      </section>

      {/* ── Entry Condition ── */}
      <section className="editor-section">
        <h3 className="section-title">Entry Condition</h3>
        <p className="section-desc">
          Optional DSL condition for room access. If set, the player cannot enter
          unless this is true.
        </p>
        <ConditionEditor
          value={room.entryCondition || ""}
          onChange={(v) => update({ entryCondition: v || undefined })}
          placeholder='e.g. player.flag("cave_key_found")'
        />
      </section>

      {/* ── Spawn Table ── */}
      <SpawnTablePanel
        entries={room.spawnTable}
        onChange={(spawnTable) => update({ spawnTable })}
      />

      {/* ── Fixed Interactables ── */}
      <FixedInteractablesPanel
        entries={room.fixedInteractables}
        onChange={(fixedInteractables) => update({ fixedInteractables })}
      />

      {/* ── Special Connections ── */}
      <RoomConnectionsPanel
        connections={room.specialConnections}
        currentRoomId={room.id}
        onChange={(specialConnections) => update({ specialConnections })}
      />

      {/* ── Seed Overrides ── */}
      <SeedOverridesPanel
        overrides={room.seedOverrides}
        onChange={(seedOverrides) => update({ seedOverrides })}
      />
    </PageShell>
  );
}
