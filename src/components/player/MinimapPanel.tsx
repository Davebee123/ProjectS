import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../../GameContext";
import { getWorld, getBundle } from "../../data/loader";
import { getReachableRooms } from "../../state/worldNavigation";
import { TRAVEL_ENERGY_COST } from "../../state/travel";
import { getActiveQuestTargets } from "../../state/quests";

interface MinimapCell {
  key: string;
  col: number;
  row: number;
  kind: "current" | "reachable" | "previous" | "locked";
  roomId?: string;
  label: string;
  clickable: boolean;
  hasQuestBang: boolean;
}

const TRAVEL_POPUP_DURATION_MS = 1400;

export function MinimapPanel() {
  const { state, dispatch } = useGame();
  const [travelPopup, setTravelPopup] = useState<{ id: number; message: string } | null>(null);
  const popupTimerRef = useRef<number | null>(null);
  const [hoverTip, setHoverTip] = useState<{
    roomId: string;
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current !== null) {
        window.clearTimeout(popupTimerRef.current);
      }
    };
  }, []);

  const showTravelPopup = (message: string) => {
    setTravelPopup({
      id: Date.now(),
      message,
    });
    if (popupTimerRef.current !== null) {
      window.clearTimeout(popupTimerRef.current);
    }
    popupTimerRef.current = window.setTimeout(() => {
      setTravelPopup(null);
      popupTimerRef.current = null;
    }, TRAVEL_POPUP_DURATION_MS);
  };

  const handleTravelClick = (roomId: string, clickable: boolean) => {
    if (!clickable) {
      showTravelPopup("Path locked");
      return;
    }
    if (state.energy < TRAVEL_ENERGY_COST) {
      showTravelPopup("Not enough energy");
      return;
    }
    dispatch({ type: "TRAVEL", roomId });
  };

  const cells = useMemo<MinimapCell[]>(() => {
    const world = getWorld();
    if (!world) {
      return [];
    }

    const currentRoom = world.rooms.find((room) => room.id === state.currentRoomId);
    if (!currentRoom) {
      return [];
    }

    const reachableRooms = getReachableRooms(state);
    const reachableById = new Map(reachableRooms.map((r) => [r.targetRoomId, r]));
    const questTargets = getActiveQuestTargets(state);
    const isTravelLocked = Boolean(
      state.action || state.exploreAction || state.travelAction || state.activeCutscene
    );

    const result: MinimapCell[] = [
      {
        key: `${currentRoom.gridX}_${currentRoom.gridY}`,
        col: 2,
        row: 2,
        kind: "current",
        roomId: currentRoom.id,
        label: currentRoom.name,
        clickable: false,
        hasQuestBang: questTargets.roomIds.has(currentRoom.id),
      },
    ];

    // Iterate ALL world rooms adjacent to current; mark reachable, previous, or locked.
    for (const room of world.rooms) {
      if (room.id === currentRoom.id) continue;
      const dx = room.gridX - currentRoom.gridX;
      const dy = room.gridY - currentRoom.gridY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue;
      if (dx === 0 && dy === 0) continue;

      const reach = reachableById.get(room.id);
      const isPrevious = room.id === state.previousRoomId;
      const clickable = Boolean(reach) && !isTravelLocked;

      let kind: MinimapCell["kind"];
      if (isPrevious) kind = "previous";
      else if (reach) kind = "reachable";
      else kind = "locked";

      const visited =
        room.id === state.previousRoomId ||
        Boolean(
          state.roomSpawnCounts[room.id] &&
            Object.keys(state.roomSpawnCounts[room.id]).length > 0
        );
      result.push({
        key: `${room.gridX}_${room.gridY}`,
        col: dx + 2,
        row: dy + 2,
        kind,
        roomId: room.id,
        label: visited ? (reach?.label ?? room.name) : "Unknown",
        clickable,
        hasQuestBang: questTargets.roomIds.has(room.id),
      });
    }

    return result;
  }, [
    state.currentRoomId,
    state.previousRoomId,
    state.playerStorage,
    state.skills,
    state.inventory,
    state.inventoryEquipment,
    state.activeEffects,
    state.exploreCount,
    state.action,
    state.exploreAction,
    state.travelAction,
    state.activeCutscene,
    state.roomSpawnCounts,
  ]);

  // Build tooltip content: spawn breakdown for the hovered room.
  const isRoomVisited = (roomId: string) => {
    if (roomId === state.currentRoomId) return true;
    if (roomId === state.previousRoomId) return true;
    const counts = state.roomSpawnCounts[roomId];
    return Boolean(counts && Object.keys(counts).length > 0);
  };

  const tooltipData = useMemo(() => {
    if (!hoverTip) return null;
    const counts = state.roomSpawnCounts[hoverTip.roomId] ?? {};
    const bundle = getBundle();
    const world = getWorld();
    const visited = isRoomVisited(hoverTip.roomId);
    const roomName = visited
      ? (world?.rooms.find((r) => r.id === hoverTip.roomId)?.name ?? hoverTip.roomId)
      : "Unknown Location";
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const encounters: { name: string; count: number; pct: number }[] = [];
    const npcs: { name: string; count: number }[] = [];
    // NPC rows are excluded from the % denominator so spawn-rate reflects
    // actual encounters only.
    const encounterTotal = entries.reduce((acc, [interId, n]) => {
      const def = bundle?.interactables.find((i) => i.id === interId);
      return def?.activityTag === "npc" ? acc : acc + n;
    }, 0);
    for (const [interId, n] of entries) {
      const def = bundle?.interactables.find((i) => i.id === interId);
      const name = def?.name ?? interId;
      if (def?.activityTag === "npc") {
        npcs.push({ name, count: n });
      } else {
        const pct = encounterTotal > 0 ? Math.round((n / encounterTotal) * 100) : 0;
        encounters.push({ name, count: n, pct });
      }
    }
    return { roomName, encounters, npcs };
  }, [hoverTip, state.roomSpawnCounts]);

  return (
    <div className="minimap-section">
      <div className="section-header-bar">
        <p className="section-label">Minimap</p>
      </div>
      <div className="section-divider-body">
        {travelPopup ? (
          <div key={travelPopup.id} className="minimap-popup">
            <div className="minimap-popup-message">{travelPopup.message}</div>
            <div className="timed-popup-progress">
              <div
                className="timed-popup-progress-fill timed-popup-progress-fill--animated"
                style={{ animationDuration: `${TRAVEL_POPUP_DURATION_MS}ms` }}
              />
            </div>
          </div>
        ) : null}
        <div className="minimap-grid">
          {cells.map((cell) => {
            const content =
              cell.kind === "current"
                ? "\u2605"
                : cell.kind === "previous"
                  ? "\u2190"
                  : cell.kind === "locked"
                    ? "?"
                    : "";
            const className = `minimap-tile is-${cell.kind} ${cell.clickable ? "is-clickable" : ""}`;

            return (
              <button
                key={cell.key}
                type="button"
                className={className}
                style={{ gridColumn: cell.col, gridRow: cell.row }}
                title={cell.label}
                disabled={cell.kind === "locked" ? false : !cell.clickable && cell.kind !== "current"}
                onClick={() => cell.roomId && cell.kind !== "current" && handleTravelClick(cell.roomId, cell.clickable)}
                onMouseEnter={(e) => {
                  if (!cell.roomId) return;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setHoverTip({
                    roomId: cell.roomId,
                    top: rect.bottom + 6,
                    left: rect.left + rect.width / 2,
                  });
                }}
                onMouseLeave={() => setHoverTip(null)}
              >
                <span className="minimap-tile-label">{content}</span>
                {cell.hasQuestBang ? <span className="quest-bang quest-bang--minimap">!</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {tooltipData && hoverTip
        ? createPortal(
            <div
              className="minimap-tooltip"
              style={{
                position: "fixed",
                top: hoverTip.top,
                left: hoverTip.left,
                transform: "translateX(-50%)",
                zIndex: 1500,
                pointerEvents: "none",
              }}
            >
              <div className="minimap-tooltip-name">{tooltipData.roomName}</div>
              <div className="minimap-tooltip-section-label">Encounters</div>
              {tooltipData.encounters.length === 0 ? (
                <div className="minimap-tooltip-empty">None recorded</div>
              ) : (
                <ul className="minimap-tooltip-list">
                  {tooltipData.encounters.map((item) => (
                    <li key={item.name} className="minimap-tooltip-row">
                      <span className="minimap-tooltip-label">{item.name}</span>
                      <span className="minimap-tooltip-value">
                        {item.pct}% ({item.count})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="minimap-tooltip-section-label">NPCs</div>
              {tooltipData.npcs.length === 0 ? (
                <div className="minimap-tooltip-empty">None</div>
              ) : (
                <ul className="minimap-tooltip-list">
                  {tooltipData.npcs.map((item) => (
                    <li key={item.name} className="minimap-tooltip-row">
                      <span className="minimap-tooltip-label">{item.name}</span>
                      <span className="minimap-tooltip-value">({item.count})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
