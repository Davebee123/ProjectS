import { useMemo } from "react";
import { useGame } from "../../GameContext";
import { InteractableCard } from "./InteractableCard";
import {
  selectRoomName,
  selectRoomExits,
  selectObjectFloatMap,
  selectObjectAreaFloatTexts,
  getRelevantPassiveLevel,
  getSuccessChance,
} from "../../state";
import { getBundle } from "../../data/loader";

export function WorldColumn() {
  const { state, dispatch } = useGame();

  const roomName = useMemo(() => selectRoomName(state), [state.currentRoomId]);
  const roomExits = useMemo(
    () => selectRoomExits(state),
    [state.currentRoomId, state.playerStorage, state.skills]
  );

  const objectFloatMap = useMemo(() => selectObjectFloatMap(state), [state.floatTexts]);
  const objectAreaFloats = useMemo(() => selectObjectAreaFloatTexts(state), [state.floatTexts]);
  const renderedObjects = useMemo(() => {
    const base = state.objects.map((object) => ({ object, isExtinguishing: false }));
    const cues = [...state.destroyedObjectCues].sort((a, b) => a.index - b.index);

    for (const cue of cues) {
      const insertAt = Math.max(0, Math.min(base.length, cue.index));
      base.splice(insertAt, 0, { object: cue.object, isExtinguishing: true });
    }

    return base;
  }, [state.objects, state.destroyedObjectCues]);

  const isExploring = Boolean(state.exploreAction);
  const exploreProgress = state.exploreAction
    ? Math.max(0, Math.min(100, ((state.now - state.exploreAction.startedAt) / (state.exploreAction.endsAt - state.exploreAction.startedAt)) * 100))
    : 0;
  const exploreProgressRounded = Math.round(exploreProgress);

  // Room data from bundle
  const roomData = useMemo(() => {
    const bundle = getBundle();
    const room = bundle?.world.rooms.find((r) => r.id === state.currentRoomId);
    return {
      description: room?.description ?? "",
      level: room?.level ?? 1,
      backgroundImage: room?.backgroundImage,
    };
  }, [state.currentRoomId]);

  return (
    <div
      className="column column-world"
      style={roomData.backgroundImage ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.5)), url(${roomData.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {/* Location header */}
      <div className="location-header">
        <div className="location-header-left">
          <div className="location-level-badge">
            <span className="location-level-value">Lvl {roomData.level}</span>
          </div>
          <div className="location-info">
            <span className="location-eyebrow">Location</span>
            <h2 className="location-name">{roomName}</h2>
          </div>
        </div>
        <button
          type="button"
          className={`explore-button ${isExploring ? "is-exploring" : ""}`}
          onClick={() => dispatch({ type: "EXPLORE" })}
          disabled={isExploring}
        >
          {isExploring && (
            <span className="explore-progress">
              <span className="explore-progress-fill" style={{ width: `${exploreProgress}%` }} />
            </span>
          )}
        </button>
      </div>

      {/* Room exits */}
      {roomExits.length > 0 && (
        <div className="exits-strip">
          {roomExits.map((exit) => (
            <button
              key={exit.targetRoomId}
              type="button"
              className="exit-button"
              onClick={() => dispatch({ type: "TRAVEL", roomId: exit.targetRoomId })}
            >
              {exit.label}
            </button>
          ))}
        </div>
      )}

      {/* Room description */}
      {roomData.description && (
        <div className="location-description-card">
          <p className="room-description">{roomData.description}</p>
        </div>
      )}

      <div className="world-stage">
        {/* Float texts */}
        {objectAreaFloats.length > 0 && !isExploring && (
          <div className="floating-feed floating-feed-objects">
            {objectAreaFloats.map((entry, i) => (
              <div key={`${entry}_${i}`} className="floating-line">{entry}</div>
            ))}
          </div>
        )}

        {isExploring ? (
          <div className="explore-overlay" aria-live="polite">
            <p className="explore-overlay-title">Exploring</p>
            <div className="explore-overlay-progress-row">
              <div className="explore-overlay-progress">
                <div
                  className="explore-overlay-progress-fill"
                  style={{ width: `${exploreProgress}%` }}
                />
              </div>
              <span className="explore-overlay-percent">{exploreProgressRounded}%</span>
            </div>
          </div>
        ) : null}

        {/* Interactable cards */}
        <div className={`interactable-grid ${isExploring ? "is-exploring" : ""}`}>
          {renderedObjects.length > 0 ? (
            renderedObjects.map(({ object, isExtinguishing }, index) => {
              const passiveLevel = getRelevantPassiveLevel(state.skills, object.tag);
              const successChance = getSuccessChance(passiveLevel, object.requiredLevel);
              const justHit =
                !isExtinguishing &&
                state.lastAction?.objectId === object.id &&
                state.now - state.lastAction.at <= 220 &&
                Boolean(state.skills.find((s) => s.id === state.lastAction?.skillId)?.abilityTags.includes("chop"));
              const revealDelayMs = isExtinguishing ? 0 : index * 500;
              const revealDurationMs = 450;
              const shouldReveal = !isExtinguishing && state.now - state.objectBatchStartedAt <= revealDelayMs + revealDurationMs;

              return (
                <InteractableCard
                  key={isExtinguishing ? `destroyed_${object.id}_${index}` : object.id}
                  object={object}
                  selected={!isExtinguishing && object.id === state.selectedObjectId}
                  successChance={successChance}
                  floatingLabels={isExtinguishing ? undefined : objectFloatMap.get(object.id)}
                  isHitShaking={justHit}
                  isExtinguishing={isExtinguishing}
                  shouldReveal={shouldReveal}
                  revealDelay={revealDelayMs}
                  onClick={() => dispatch({ type: "SELECT_OBJECT", objectId: object.id })}
                />
              );
            })
          ) : (
            <p className="empty-text">No objects nearby. Press Explore.</p>
          )}
        </div>
      </div>
    </div>
  );
}
