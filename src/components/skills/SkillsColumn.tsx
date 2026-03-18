import { useMemo, useState } from "react";
import { useGame } from "../../GameContext";
import { SkillBar } from "./SkillBar";
import {
  selectSkillFloatMap,
  selectSkillAreaFloatTexts,
} from "../../state";

const PASSIVES_PER_PAGE = 4;

export function SkillsColumn() {
  const { state, dispatch } = useGame();
  const [passivePage, setPassivePage] = useState(0);

  const passiveSkills = useMemo(
    () => state.skills.filter((s) => s.kind === "passive"),
    [state.skills]
  );

  const activeSkills = useMemo(
    () => state.skills.filter((s) => s.kind === "active" && s.unlocked),
    [state.skills]
  );

  const skillFloatMap = useMemo(() => selectSkillFloatMap(state), [state.floatTexts]);

  const skillAreaFloats = useMemo(
    () => selectSkillAreaFloatTexts(state),
    [state.floatTexts]
  );

  const unlockFadeSet = useMemo(
    () => new Set(state.unlockCues.filter((c) => c.expiresAt > state.now).map((c) => c.skillId)),
    [state.unlockCues, state.now]
  );

  const selectedObject = useMemo(
    () => state.objects.find((o) => o.id === state.selectedObjectId) ?? null,
    [state.objects, state.selectedObjectId]
  );

  const actionProgress = state.action
    ? Math.max(0, Math.min(100, ((state.now - state.action.startedAt) / state.action.durationMs) * 100))
    : 0;

  const totalPassivePages = Math.max(1, Math.ceil(passiveSkills.length / PASSIVES_PER_PAGE));
  const visiblePassives = passiveSkills.slice(
    passivePage * PASSIVES_PER_PAGE,
    (passivePage + 1) * PASSIVES_PER_PAGE
  );

  return (
    <div className="column column-skills">
      {skillAreaFloats.length > 0 && (
        <div className="floating-feed floating-feed-skills">
          {skillAreaFloats.map((entry, i) => (
            <div key={`${entry}_${i}`} className="floating-line">{entry}</div>
          ))}
        </div>
      )}

      <div className="section-header-row">
        <p className="section-label">Passive Skills</p>
        {totalPassivePages > 1 && (
          <div className="section-nav-arrows">
            <button
              type="button"
              className="section-nav-btn"
              disabled={passivePage <= 0}
              onClick={() => setPassivePage((p) => p - 1)}
            >
              {"\u25C0"}
            </button>
            <div className="section-nav-dots" aria-hidden="true">
              <span className="section-nav-dot" />
              <span className="section-nav-dot is-active" />
            </div>
            <button
              type="button"
              className="section-nav-btn"
              disabled={passivePage >= totalPassivePages - 1}
              onClick={() => setPassivePage((p) => p + 1)}
            >
              {"\u25B6"}
            </button>
          </div>
        )}
      </div>

      {visiblePassives.map((skill) => (
        <div key={skill.id} className="skill-bar-group">
          <SkillBar
            variant="passive"
            name={skill.name}
            level={skill.level}
            xp={skill.xp}
            xpToNext={skill.xpToNext}
            color={skill.barColor}
            accent={skill.accentColor}
            floatingLabels={skillFloatMap.get(skill.id)}
            tooltip={skill.description}
          />
        </div>
      ))}

      <p className="section-label section-label-active">Active Abilities</p>
      {activeSkills.map((skill) => {
        const canTarget = selectedObject ? skill.tags.includes(selectedObject.tag) : false;
        const isAuto = state.autoSkillId === skill.id;
        const isBonusReady =
          (skill.id === "downward_chop" && state.downwardBonusReady) ||
          (skill.id === "side_chop" && state.sidePrepUpwardStreak >= 2 && state.sidePrepDownwardHit);
        const activationPct = state.action?.skillId === skill.id ? actionProgress : 0;
        const castSeconds = skill.id === "downward_chop" && state.downwardBonusReady
          ? 2
          : skill.baseDurationMs / 1000;
        const shortDetails = `${castSeconds.toFixed(1)}s | \u26A1${skill.baseEnergyCost}`;

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
              details={shortDetails}
              muted={!canTarget && !isAuto}
              auto={isAuto}
              bonusReady={isBonusReady}
              badge={isAuto ? "AUTO" : undefined}
              floatingLabels={skillFloatMap.get(skill.id)}
              unlockFadeIn={unlockFadeSet.has(skill.id)}
              accentPct={activationPct}
              showAccent
              onClick={() => dispatch({ type: "SET_AUTO_SKILL", skillId: skill.id })}
            />
          </div>
        );
      })}
    </div>
  );
}
