import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useWorldStore } from "../../stores/worldStore";
import { ConditionEditor } from "../shared/ConditionEditor";
import { FilePathInput } from "../shared/FilePathInput";
import { SpawnTablePanel } from "./SpawnTablePanel";
import { FixedInteractablesPanel } from "./FixedInteractablesPanel";
import { RoomConnectionsPanel } from "./RoomConnectionsPanel";
import { SeedOverridesPanel } from "./SeedOverridesPanel";
import { toPublicAssetPath } from "../../utils/assets";

const MAX_ROOM_DESCRIPTION_CHARS = 500;

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
  const backgroundImageSrc = toPublicAssetPath(room.backgroundImage);

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
            <textarea
              className="input"
              value={room.description}
              onChange={(e) => update({ description: e.target.value.slice(0, MAX_ROOM_DESCRIPTION_CHARS) })}
              placeholder="What the player sees when entering..."
              maxLength={MAX_ROOM_DESCRIPTION_CHARS}
              rows={4}
            />
            <p className="section-desc" style={{ marginBottom: 0, marginTop: 8 }}>
              {room.description.length}/{MAX_ROOM_DESCRIPTION_CHARS} characters
            </p>
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

      {/* ── Ambient Sound ── */}
      <section className="editor-section">
        <h3 className="section-title">Room Audio</h3>
        <p className="section-desc">
          Background music and ambient sound are separate looping channels. Paths are relative to{" "}
          <code>public/</code>. Leave blank for silence.
        </p>
        <FilePathInput
          label="Background Music"
          value={room.backgroundMusic || ""}
          onChange={(v) => update({ backgroundMusic: v || undefined })}
          placeholder="Sound Files/Background Music Project S.mp3"
          accept="audio/*"
          pathPrefix="Sound Files"
        />
        <div style={{ height: 12 }} />
        <p className="section-desc">
          Ambient sound is for room tone like wind, insects, rain, machinery, or cave noise.
        </p>
        <FilePathInput
          label="Ambient Sound"
          value={room.ambientSound || ""}
          onChange={(v) => update({ ambientSound: v || undefined })}
          placeholder="Sound Files/ThunderAndRain.wav"
          accept="audio/*"
          pathPrefix="Sound Files"
        />
      </section>

      {/* ── Background Image ── */}
      <section className="editor-section">
        <h3 className="section-title">Background Image</h3>
        <p className="section-desc">
          Optional background image displayed behind the room in the game. Path is relative to{" "}
          <code>public/</code>.
        </p>
        <FilePathInput
          label="Image File"
          value={room.backgroundImage || ""}
          onChange={(v) => update({ backgroundImage: v || undefined })}
          placeholder="images/rooms/forest_bg.png"
          accept="image/*"
          pathPrefix="images"
        />
      </section>

      <section className="editor-section">
        <h3 className="section-title">Preview</h3>
        <p className="section-desc">
          Compact room presentation preview for title, description, and background treatment.
        </p>
        <div className="room-preview-card">
          {backgroundImageSrc ? (
            <div
              className="room-preview-backdrop"
              style={{
                backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.94), rgba(0, 0, 0, 0.94)), url("${backgroundImageSrc}")`,
              }}
            />
          ) : (
            <div className="room-preview-backdrop room-preview-backdrop--empty" />
          )}
          <div className="room-preview-content">
            <div className="room-preview-title-row">
              <div className="room-preview-level">Lvl {room.level ?? 1}</div>
              <div>
                <div className="room-preview-label">Location</div>
                <h4 className="room-preview-title">{room.name || room.id}</h4>
              </div>
            </div>
            <div className="room-preview-description">
              {room.description || "Room description preview."}
            </div>
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
