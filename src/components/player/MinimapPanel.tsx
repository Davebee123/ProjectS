import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../GameContext";
import { getWorld } from "../../data/loader";
import { getReachableRooms } from "../../state/worldNavigation";
import { TRAVEL_ENERGY_COST } from "../../state/travel";

interface MinimapCell {
  key: string;
  col: number;
  row: number;
  kind: "current" | "room" | "previous";
  roomId?: string;
  label: string;
  clickable: boolean;
}

const TRAVEL_POPUP_DURATION_MS = 1400;

export function MinimapPanel() {
  const { state, dispatch } = useGame();
  const [travelPopup, setTravelPopup] = useState<{ id: number; message: string } | null>(null);
  const popupTimerRef = useRef<number | null>(null);

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

  const handleTravelClick = (roomId: string) => {
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
    const isTravelLocked = Boolean(state.action || state.exploreAction || state.travelAction || state.activeCutscene);

    const cells: MinimapCell[] = [
      {
        key: `${currentRoom.gridX}_${currentRoom.gridY}`,
        col: 2,
        row: 2,
        kind: "current",
        roomId: currentRoom.id,
        label: currentRoom.name,
        clickable: false,
      },
    ];

    for (const room of reachableRooms) {
      const dx = room.gridX - currentRoom.gridX;
      const dy = room.gridY - currentRoom.gridY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        continue;
      }

      const isPrevious = room.targetRoomId === state.previousRoomId;
      cells.push({
        key: `${room.gridX}_${room.gridY}`,
        col: dx + 2,
        row: dy + 2,
        kind: isPrevious ? "previous" : "room",
        roomId: room.targetRoomId,
        label: isPrevious ? `${room.label} (previous)` : room.label,
        clickable: !isTravelLocked,
      });
    }

    return cells;
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
  ]);

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
              cell.kind === "current" ? "\u2605" : cell.kind === "previous" ? "\u2190" : "";
            const className = `minimap-tile is-${cell.kind} ${cell.clickable ? "is-clickable" : ""}`;

            return (
              <button
                key={cell.key}
                type="button"
                className={className}
                style={{ gridColumn: cell.col, gridRow: cell.row }}
                title={cell.label}
                disabled={!cell.clickable}
                onClick={() => cell.roomId && handleTravelClick(cell.roomId)}
              >
                <span className="minimap-tile-label">{content}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
