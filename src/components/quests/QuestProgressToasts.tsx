import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGame } from "../../GameContext";
import type { PassiveProgressCue } from "../../state/types";
import { ProgressBar } from "../shared/ProgressBar";

function PassiveProgressToast({ cue }: { cue: PassiveProgressCue }) {
  const [displayValue, setDisplayValue] = useState(cue.currentValue);
  const [displayMax, setDisplayMax] = useState(cue.requiredValue);

  useEffect(() => {
    let resetTimer: number | null = null;
    let finishTimer: number | null = null;

    if (cue.leveledUp) {
      setDisplayMax(Math.max(1, cue.previousRequiredValue));
      setDisplayValue(Math.max(0, cue.previousValue));
      resetTimer = window.setTimeout(() => {
        setDisplayValue(Math.max(1, cue.previousRequiredValue));
        finishTimer = window.setTimeout(() => {
          setDisplayMax(cue.requiredValue);
          setDisplayValue(0);
          requestAnimationFrame(() => {
            setDisplayValue(cue.currentValue);
          });
        }, 180);
      }, 0);
    } else {
      setDisplayMax(cue.requiredValue);
      setDisplayValue(cue.previousValue);
      requestAnimationFrame(() => {
        setDisplayValue(cue.currentValue);
      });
    }

    return () => {
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      if (finishTimer !== null) window.clearTimeout(finishTimer);
    };
  }, [cue]);

  return (
    <div
      className="quest-progress-toast quest-progress-toast-passive"
      style={
        {
          "--quest-passive-accent": cue.accentColor,
          "--quest-passive-border": cue.accentColor,
        } as CSSProperties
      }
    >
      <div className="quest-progress-toast-copy">
        <div className="quest-progress-toast-copy-block">
          <span className="quest-progress-toast-kicker">Passive Progress</span>
          <span className="quest-progress-toast-title">
            {cue.skillName} Lv {cue.level}
          </span>
        </div>
        <div className="quest-progress-toast-copy-block quest-progress-toast-copy-block-right">
          {cue.leveledUp ? (
            <span className="quest-progress-toast-level-up">Level Up!</span>
          ) : null}
          <span className="quest-progress-toast-value">+{cue.xpGained} XP</span>
        </div>
      </div>
      <div className="quest-progress-toast-bar">
        <ProgressBar
          value={displayValue}
          max={displayMax}
          color={cue.barColor}
          height={8}
          showValues={false}
        />
        <div className="quest-progress-toast-bar-meta">
          {cue.currentValue}/{cue.requiredValue}
        </div>
      </div>
    </div>
  );
}

export function QuestProgressToasts() {
  const { state } = useGame();
  const visibleCues = useMemo(
    () => state.questProgressCues.filter((cue) => cue.appearsAt <= state.now),
    [state.questProgressCues, state.now]
  );
  const visiblePassiveCues = useMemo(
    () => state.passiveProgressCues.filter((cue) => cue.appearsAt <= state.now),
    [state.passiveProgressCues, state.now]
  );

  if (visibleCues.length === 0 && visiblePassiveCues.length === 0) {
    return null;
  }

  return (
    <div className="quest-progress-toast-stack" aria-live="polite">
      {visibleCues.map((cue) => (
        <div key={cue.id} className="quest-progress-toast">
          <div className="quest-progress-toast-copy">
            <span className="quest-progress-toast-title">{cue.title}</span>
            <span className="quest-progress-toast-value">
              {cue.currentValue}/{cue.requiredValue}
            </span>
          </div>
          <div className="quest-progress-toast-bar">
            <ProgressBar
              value={cue.currentValue}
              max={cue.requiredValue}
              color="rgba(150, 150, 150, 0.92)"
              height={8}
              showValues={false}
            />
          </div>
        </div>
      ))}
      {visiblePassiveCues.map((cue) => (
        <PassiveProgressToast key={cue.id} cue={cue} />
      ))}
    </div>
  );
}
