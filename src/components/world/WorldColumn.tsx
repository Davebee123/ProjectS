import { useEffect, useMemo, useRef } from "react";
import { useGame } from "../../GameContext";
import { playManaged, stopManaged, playSound } from "../../audio";
import { InteractableCard } from "./InteractableCard";
import { DialoguePanel } from "./DialoguePanel";
import {
  selectRoomName,
  selectObjectImpactMap,
  getRelevantPassiveLevel,
  getSuccessChance,
} from "../../state";
import { getBundle } from "../../data/loader";
import { getActiveQuestTargets } from "../../state/quests";

const MAX_ROOM_DESCRIPTION_CHARS = 500;
const LEAF_PARTICLE_TAGS = new Set(["bushes", "trees", "plants", "herbs"]);
const FOOTSTEP_SOUND = "/Sound Files/FootstepsExploring.mp3";
const FOOTSTEP_VOLUME = 0.2;
const INTERACTABLE_REVEAL_STAGGER_MS = 420;
const INTERACTABLE_REVEAL_DURATION_MS = 950;

function truncateRoomDescription(text: string): string {
  if (text.length <= MAX_ROOM_DESCRIPTION_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_ROOM_DESCRIPTION_CHARS - 1).trimEnd()}...`;
}

export function WorldColumn() {
  const { state, dispatch } = useGame();
  const bundle = getBundle();

  const roomName = useMemo(() => selectRoomName(state), [state.currentRoomId]);
  const questTargets = useMemo(
    () => getActiveQuestTargets(state),
    [
      state.currentRoomId,
      state.playerStorage,
      state.inventory,
      state.skills,
      state.activeEffects,
    ]
  );

  const objectImpactMap = useMemo(() => selectObjectImpactMap(state), [state.floatTexts]);
  const attackingObjectIds = useMemo(
    () => new Set(state.objectAttackCues.map((cue) => cue.objectId)),
    [state.objectAttackCues]
  );
  const objectEmoteMap = useMemo(() => {
    const map = new Map<string, (typeof state.objectEmoteCues)[number]>();
    for (const cue of state.objectEmoteCues) {
      if (cue.expiresAt > state.now) {
        map.set(cue.objectId, cue);
      }
    }
    return map;
  }, [state.objectEmoteCues, state.now]);
  const visibleLootReceiptCues = useMemo(
    () => state.lootReceiptCues.filter((cue) => cue.appearsAt <= state.now),
    [state.lootReceiptCues, state.now]
  );
  const renderedObjects = useMemo(() => {
    const base: Array<
      | { kind: "object"; object: (typeof state.objects)[number]; isExtinguishing: false }
      | { kind: "destroyed"; object: (typeof state.objects)[number]; isExtinguishing: true; lootCue: (typeof state.lootReceiptCues)[number] | null }
    > = state.objects
      .filter((object) => object.id !== state.activeDialogue?.objectId)
      .map((object) => ({ kind: "object" as const, object, isExtinguishing: false as const }));
    const cues = [...state.destroyedObjectCues].sort((a, b) => a.index - b.index);

    for (const cue of cues) {
      const lootCue = visibleLootReceiptCues.find((lc) => lc.objectId === cue.object.id) ?? null;
      const insertAt = Math.max(0, Math.min(base.length, cue.index));
      base.splice(insertAt, 0, { kind: "destroyed", object: cue.object, isExtinguishing: true, lootCue });
    }

    return base;
  }, [state.objects, state.destroyedObjectCues, state.activeDialogue?.objectId, visibleLootReceiptCues]);

  const isCutsceneActive = Boolean(state.activeCutscene);
  const isCutsceneDialogue = Boolean(state.activeCutscene?.awaitingDialogue && state.activeDialogue);
  const isExploring = Boolean(state.exploreAction);
  const isTraveling = Boolean(state.travelAction);
  const wasExploring = useRef(false);
  const wasTraveling = useRef(false);
  useEffect(() => {
    if (wasExploring.current && !isExploring) {
      stopManaged("explore");
    }
    wasExploring.current = isExploring;
  }, [isExploring]);
  useEffect(() => {
    if (!wasTraveling.current && isTraveling) {
      playManaged("travel", FOOTSTEP_SOUND, FOOTSTEP_VOLUME);
    }
    if (wasTraveling.current && !isTraveling) {
      stopManaged("travel");
    }
    wasTraveling.current = isTraveling;
  }, [isTraveling]);
  useEffect(() => {
    return () => {
      stopManaged("explore");
      stopManaged("travel");
    };
  }, []);

  // Play grab sound when new loot receipts appear
  const prevLootCountRef = useRef(state.lootReceiptCues.length);
  useEffect(() => {
    if (state.lootReceiptCues.length > prevLootCountRef.current) {
      playSound("/Sound Files/GrabItem.wav", 0.25);
    }
    prevLootCountRef.current = state.lootReceiptCues.length;
  }, [state.lootReceiptCues.length]);
  const isWorldBusy = isExploring || isTraveling || isCutsceneActive;
  const exploreProgress = state.exploreAction
    ? Math.max(0, Math.min(100, ((state.now - state.exploreAction.startedAt) / (state.exploreAction.endsAt - state.exploreAction.startedAt)) * 100))
    : 0;
  const exploreProgressRounded = Math.round(exploreProgress);
  const travelProgress = state.travelAction
    ? Math.max(0, Math.min(100, ((state.now - state.travelAction.startedAt) / (state.travelAction.endsAt - state.travelAction.startedAt)) * 100))
    : 0;
  const travelProgressRounded = Math.round(travelProgress);

  const roomData = useMemo(() => {
    const room = bundle?.world.rooms.find((r) => r.id === state.currentRoomId);
    return {
      description: truncateRoomDescription(room?.description ?? ""),
      level: room?.level ?? 1,
      backgroundImage: room?.backgroundImage,
    };
  }, [bundle, state.currentRoomId]);

  return (
    <div
      className="column column-world"
      style={roomData.backgroundImage ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.78), rgba(0,0,0,0.85)), url("${roomData.backgroundImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
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
          onClick={() => {
            playManaged("explore", FOOTSTEP_SOUND, FOOTSTEP_VOLUME);
            dispatch({ type: "EXPLORE" });
          }}
          disabled={isWorldBusy}
        >
          {isExploring && (
            <span className="explore-progress">
              <span className="explore-progress-fill" style={{ width: `${exploreProgress}%` }} />
            </span>
          )}
        </button>
      </div>

      {roomData.description && (
        <div className="location-description-card">
          <p className="room-description">{roomData.description}</p>
        </div>
      )}

      <div className="world-stage">
        {state.activeDialogue && isCutsceneDialogue ? <DialoguePanel /> : null}

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

        {isTraveling ? (
          <div className="explore-overlay" aria-live="polite">
            <p className="explore-overlay-title">Traveling</p>
            <div className="explore-overlay-progress-row">
              <div className="explore-overlay-progress">
                <div
                  className="explore-overlay-progress-fill"
                  style={{ width: `${travelProgress}%` }}
                />
              </div>
              <span className="explore-overlay-percent">{travelProgressRounded}%</span>
            </div>
          </div>
        ) : null}

        {!isCutsceneDialogue ? (
          <div className={`interactable-grid ${isWorldBusy ? "is-exploring" : ""}`}>
            {state.activeDialogue ? <DialoguePanel inline /> : null}
            {renderedObjects.length > 0 ? (
              renderedObjects.map((entry, index) => {
                // Destroyed object with a visible loot receipt: render loot inline
                if (entry.kind === "destroyed" && entry.lootCue) {
                  const cue = entry.lootCue;
                  return (
                    <div key={`loot_inline_${cue.id}`} className="loot-receipt-popup loot-receipt-inline">
                      <button
                        type="button"
                        className="loot-receipt-dismiss"
                        onClick={() => dispatch({ type: "DISMISS_LOOT_RECEIPT", cueId: cue.id })}
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>
                      <div className="loot-receipt-header">
                        <p className="loot-receipt-title">YOU RECEIVED:</p>
                      </div>
                      <div className="loot-receipt-body">
                        <div className="loot-receipt-list">
                          {cue.entries.map((lootEntry) => (
                            <div key={lootEntry.id} className={`loot-receipt-item loot-receipt-rarity-${lootEntry.rarityClass}`}>
                              <div className="loot-receipt-item-shell">
                                {lootEntry.image ? (
                                  <img src={lootEntry.image} alt={lootEntry.name} />
                                ) : (
                                  <span className="loot-receipt-item-letter">{lootEntry.name[0]?.toUpperCase() ?? "?"}</span>
                                )}
                              </div>
                              <div className="loot-receipt-item-copy">
                                <span className="loot-receipt-name">{lootEntry.name}</span>
                                <span className="loot-receipt-qty">{lootEntry.qty > 1 ? `x${lootEntry.qty}` : "x1"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="timed-popup-progress">
                        <div
                          className="timed-popup-progress-fill"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                ((cue.expiresAt - state.now) / Math.max(1, cue.expiresAt - cue.appearsAt)) * 100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                }

                // Destroyed object still extinguishing (no loot yet or no loot at all)
                if (entry.kind === "destroyed") {
                  return (
                    <InteractableCard
                      key={`destroyed_${entry.object.id}_${index}`}
                      object={entry.object}
                      selected={false}
                      successChance={0}
                      statusEffects={[]}
                      isAttackAnimating={false}
                      isHitShaking={false}
                      isExtinguishing
                      shouldReveal={false}
                      revealDelay={0}
                      revealDuration={INTERACTABLE_REVEAL_DURATION_MS}
                      onClick={() => {}}
                    />
                  );
                }

                // Normal live object
                const { object } = entry;
                const passiveLevel = getRelevantPassiveLevel(state.skills, object.tag);
                const successChance = getSuccessChance(passiveLevel, object.requiredLevel);
                const justHit =
                  state.lastAction?.objectId === object.id &&
                  state.now - state.lastAction.at <= 220;
                const isEventSpawnReveal = object.revealStartedAt !== undefined;
                const isRoomSpawnReveal = object.sourceSpawnEntryId !== undefined;
                const revealOrderIndex = renderedObjects
                  .slice(0, index)
                  .filter((candidate) =>
                    candidate.kind === "object" && candidate.object.sourceSpawnEntryId !== undefined
                  ).length;
                const revealStartedAt = isEventSpawnReveal ? object.revealStartedAt! : state.objectBatchStartedAt;
                const revealDelayMs = isEventSpawnReveal
                  ? (object.revealDelayMs ?? 0)
                  : revealOrderIndex * INTERACTABLE_REVEAL_STAGGER_MS;
                const revealDurationMs = object.revealDurationMs ?? INTERACTABLE_REVEAL_DURATION_MS;
                const shouldReveal =
                  (isEventSpawnReveal || isRoomSpawnReveal) &&
                  state.now - revealStartedAt <= revealDelayMs + revealDurationMs;
                const latestImpact = objectImpactMap.get(object.id)?.[0];
                const isDamageImpact = Boolean(latestImpact?.text.trim().startsWith("-"));
                const latestEmote = objectEmoteMap.get(object.id);
                const objectCast =
                  state.hostileAction?.objectId === object.id
                    ? (() => {
                        const elapsedMs = Math.max(0, state.now - state.hostileAction.startedAt);
                        const durationMs = Math.max(1, state.hostileAction.durationMs);
                        return {
                          name: state.hostileAction.abilityName,
                          progressPct: Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100)),
                          elapsedLabel: `${(elapsedMs / 1000).toFixed(1)} / ${(durationMs / 1000).toFixed(1)}s`,
                          color: object.barColor,
                        };
                      })()
                    : state.friendlyAction?.objectId === object.id
                      ? (() => {
                          const elapsedMs = Math.max(0, state.now - state.friendlyAction.startedAt);
                          const durationMs = Math.max(1, state.friendlyAction.durationMs);
                          return {
                            name: state.friendlyAction.abilityName,
                            progressPct: Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100)),
                            elapsedLabel: `${(elapsedMs / 1000).toFixed(1)} / ${(durationMs / 1000).toFixed(1)}s`,
                            color: object.barColor,
                          };
                        })()
                      : undefined;

                return (
                  <InteractableCard
                    key={object.id}
                    object={object}
                    selected={object.id === state.selectedObjectId}
                    successChance={successChance}
                    statusEffects={(object.activeEffects ?? []).map((active) => {
                      const def = bundle?.statusEffects.find((e) => e.id === active.effectId);
                      const durationMs = def?.durationMs;
                      const elapsedMs = state.now - active.appliedAt;
                      const remainingMs =
                        durationMs !== undefined ? Math.max(0, durationMs - elapsedMs) : undefined;
                      const progressPct =
                        durationMs && durationMs > 0
                          ? Math.max(0, Math.min(100, (remainingMs! / durationMs) * 100))
                          : undefined;
                      return {
                        id: active.effectId,
                        name: def?.name ?? active.effectId,
                        color: def?.color ?? "#ffffff",
                        iconImage: def?.iconImage,
                        stacks: active.stacks,
                        remainingMs,
                        progressPct,
                      };
                    })}
                    hostileCast={objectCast}
                    impactText={latestImpact ? { id: latestImpact.id, text: latestImpact.text } : undefined}
                    emoteCue={latestEmote ? { id: latestEmote.id, text: latestEmote.text, durationMs: latestEmote.durationMs } : undefined}
                    leafParticleKey={latestImpact && LEAF_PARTICLE_TAGS.has(object.tag) ? latestImpact.id : undefined}
                    bloodParticleKey={latestImpact && object.tag === "enemy" && isDamageImpact ? latestImpact.id : undefined}
                    isAttackAnimating={attackingObjectIds.has(object.id)}
                    isHitShaking={justHit}
                    isExtinguishing={false}
                    shouldReveal={shouldReveal}
                    revealDelay={revealDelayMs}
                    revealDuration={revealDurationMs}
                    hasQuestBang={questTargets.interactableIds.has(object.interactableId)}
                    onClick={() => dispatch({ type: "SELECT_OBJECT", objectId: object.id })}
                  />
                );
              })
            ) : (
              <p className="empty-text">No objects nearby. Press Explore.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
