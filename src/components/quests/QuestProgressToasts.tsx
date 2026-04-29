import { useMemo } from "react";
import { useGame } from "../../GameContext";
import { ProgressBar } from "../shared/ProgressBar";

export function QuestProgressToasts() {
  const { state } = useGame();
  const visibleCues = useMemo(
    () => state.questProgressCues.filter((cue) => cue.appearsAt <= state.now),
    [state.questProgressCues, state.now]
  );

  if (visibleCues.length === 0) {
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
    </div>
  );
}
