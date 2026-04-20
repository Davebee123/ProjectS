import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../GameContext";
import { getCutsceneDef } from "../../data/loader";

const CUTSCENE_BACKGROUND_FADE_MS = 1000;
const CUTSCENE_CONTENT_FADE_MS = 2000;

type CutsceneOverlayPhase = "hidden" | "background" | "content" | "exiting";

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function CutsceneOverlay() {
  const { state, dispatch } = useGame();
  const [phase, setPhase] = useState<CutsceneOverlayPhase>("hidden");
  const advanceTimeoutRef = useRef<number | null>(null);
  const contentRevealTimeoutRef = useRef<number | null>(null);

  const cutscene = state.activeCutscene ? getCutsceneDef(state.activeCutscene.cutsceneId) : undefined;
  const step = useMemo(
    () => cutscene?.steps.find((entry) => entry.id === state.activeCutscene?.stepId),
    [cutscene, state.activeCutscene?.stepId]
  );

  useEffect(() => {
    if (!state.activeCutscene || !cutscene || !step || step.kind !== "text" || state.activeDialogue) {
      setPhase("hidden");
      return;
    }

    setPhase("hidden");
    const frame = window.requestAnimationFrame(() => {
      setPhase("background");
      if (contentRevealTimeoutRef.current !== null) {
        window.clearTimeout(contentRevealTimeoutRef.current);
      }
      contentRevealTimeoutRef.current = window.setTimeout(() => {
        contentRevealTimeoutRef.current = null;
        setPhase("content");
      }, CUTSCENE_BACKGROUND_FADE_MS);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (contentRevealTimeoutRef.current !== null) {
        window.clearTimeout(contentRevealTimeoutRef.current);
        contentRevealTimeoutRef.current = null;
      }
    };
  }, [state.activeCutscene?.cutsceneId, step?.id, state.activeDialogue, cutscene]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
      }
      if (contentRevealTimeoutRef.current !== null) {
        window.clearTimeout(contentRevealTimeoutRef.current);
      }
    };
  }, []);

  if (!state.activeCutscene || !cutscene || !step || step.kind !== "text" || state.activeDialogue) {
    return null;
  }

  const paragraphs = splitParagraphs(step.text || "");
  const label = step.continueLabel || (step.nextStepId ? "Continue" : "Finish");
  const backgroundStyle = step.backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(3, 3, 3, 0.66), rgba(3, 3, 3, 0.9)), url(${step.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const handleAdvance = () => {
    if (phase !== "content") {
      return;
    }
    setPhase("exiting");
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
    }
    advanceTimeoutRef.current = window.setTimeout(() => {
      advanceTimeoutRef.current = null;
      dispatch({ type: "ADVANCE_CUTSCENE" });
    }, CUTSCENE_CONTENT_FADE_MS);
  };

  return (
    <div
      className={`cutscene-overlay ${
        phase === "background" ? "is-background-visible" : ""
      } ${phase === "content" ? "is-content-visible" : ""} ${phase === "exiting" ? "is-exiting" : ""}`}
      aria-live="polite"
      style={backgroundStyle}
    >
      <div className="cutscene-overlay-inner">
        <div className="cutscene-copy">
          {paragraphs.map((paragraph, index) => (
            <p key={`${step.id}_${index}`} className="cutscene-copy-line">
              {paragraph}
            </p>
          ))}
        </div>

        <button
          type="button"
          className="cutscene-continue-button"
          onClick={handleAdvance}
          disabled={phase !== "content"}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
