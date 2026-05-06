import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../GameContext";
import { SkillBar } from "./SkillBar";
import { selectSkillFloatMap } from "../../state";
import { getSkillTickMarkerPercents } from "../../state/skillTicks";
import { canPlayerUseSkillOnObject } from "../../state/skillTargeting";

export function InteractableAbilitiesPanel() {
  const { state, dispatch } = useGame();
  const [tickAnimationCue, setTickAnimationCue] = useState<{ skillId: string; at: number } | null>(null);
  const previousTickStateRef = useRef<{ skillId: string; resolvedTickCount: number } | null>(null);

  const selectedObject = useMemo(
    () => state.objects.find((object) => object.id === state.selectedObjectId) ?? null,
    [state.objects, state.selectedObjectId]
  );

  const actionProgress = state.action
    ? Math.max(0, Math.min(100, ((state.now - state.action.startedAt) / state.action.durationMs) * 100))
    : 0;

  const skillFloatMap = useMemo(() => selectSkillFloatMap(state), [state.floatTexts]);

  const unlockFadeSet = useMemo(
    () => new Set(state.unlockCues.filter((cue) => cue.expiresAt > state.now).map((cue) => cue.skillId)),
    [state.unlockCues, state.now]
  );

  useEffect(() => {
    const action = state.action;
    if (!action) {
      previousTickStateRef.current = null;
      return;
    }

    const previous = previousTickStateRef.current;
    if (
      previous &&
      previous.skillId === action.skillId &&
      action.resolvedTickCount > previous.resolvedTickCount
    ) {
      setTickAnimationCue({ skillId: action.skillId, at: state.now });
    }

    previousTickStateRef.current = {
      skillId: action.skillId,
      resolvedTickCount: action.resolvedTickCount,
    };
  }, [state.action, state.now]);

  const relevantSkills = useMemo(() => {
    if (!selectedObject) {
      return [];
    }

    return state.skills.filter((skill) => {
      if (skill.kind !== "active" || !skill.unlocked) {
        return false;
      }

      if (!canPlayerUseSkillOnObject(skill, selectedObject)) {
        return false;
      }

      return true;
    });
  }, [selectedObject, state.skills]);

  if (!selectedObject) {
    return null;
  }

  return (
    <div className="bioboard-gathering-section">
      <div className="bioboard-gathering-list">
        {relevantSkills.length > 0 ? (
          relevantSkills.map((skill) => {
            const isAuto = state.autoSkillId === skill.id;
            const isBonusReady =
              (skill.id === "downward_chop" && state.downwardBonusReady) ||
              (skill.id === "side_chop" && state.sidePrepUpwardStreak >= 2 && state.sidePrepDownwardHit);
            const isReady = skill.id !== "side_chop" || (state.sidePrepUpwardStreak >= 2 && state.sidePrepDownwardHit);
            const activationPct = state.action?.skillId === skill.id ? actionProgress : 0;
            const castSeconds = skill.id === "downward_chop" && state.downwardBonusReady
              ? 2
              : skill.baseDurationMs / 1000;
            const activeAction = state.action?.skillId === skill.id ? state.action : null;
            const tickMarkersPct =
              activeAction
                ? activeAction.tickMomentsMs.map((tickMoment) =>
                    Math.max(0, Math.min(100, (tickMoment / activeAction.durationMs) * 100))
                  )
                : getSkillTickMarkerPercents(skill, skill.baseDurationMs);
            const shortDetails = `${castSeconds.toFixed(1)}s | \u26A1${skill.baseEnergyCost}${tickMarkersPct.length > 0 ? ` | ${tickMarkersPct.length} Ticks` : ""}`;
            const resolvedTickCount = activeAction ? activeAction.resolvedTickCount : 0;
            const hasRecentTickAnimationCue =
              tickAnimationCue?.skillId === skill.id &&
              state.now - tickAnimationCue.at <= 220;

            return (
              <div key={skill.id} className="skill-bar-group">
                <SkillBar
                  variant="active"
                  name={skill.name}
                  level={skill.level}
                  xp={skill.xp}
                  xpToNext={skill.xpToNext}
                  color={skill.barColor}
                  accent={skill.accentColor}
                  perkMilestones={skill.perkMilestones}
                  details={shortDetails}
                  muted={!isReady && !isAuto}
                  auto={isAuto}
                  bonusReady={isBonusReady}
                  castComplete={
                    hasRecentTickAnimationCue ||
                    state.lastAction?.skillId === skill.id &&
                    state.now - state.lastAction.at <= 300
                  }
                  badge={isAuto ? "AUTO" : undefined}
                  floatingLabels={skillFloatMap.get(skill.id)}
                  tooltip={skill.description}
                  unlockFadeIn={unlockFadeSet.has(skill.id)}
                  accentPct={activationPct}
                  showAccent
                  tickMarkersPct={tickMarkersPct}
                  resolvedTickCount={resolvedTickCount}
                  onClick={() => dispatch({ type: "SET_AUTO_SKILL", skillId: skill.id })}
                />
              </div>
            );
          })
        ) : (
          <p className="empty-text">No abilities match this interactable.</p>
        )}
      </div>
    </div>
  );
}
