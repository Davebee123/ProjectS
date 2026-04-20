import { useEffect, useState, useRef } from "react";
import { parseDialogueText } from "../../../shared/content/dialogueText";

interface FormattedDialogueTextProps {
  text: string;
  typewriter?: boolean;
  /** Characters revealed per second (default 40) */
  speed?: number;
  /** Called when the typewriter finishes (or immediately if typewriter is off) */
  onComplete?: () => void;
  /** When true, immediately reveal all text */
  skipToEnd?: boolean;
}

export function FormattedDialogueText({
  text,
  typewriter,
  speed = 40,
  onComplete,
  skipToEnd,
}: FormattedDialogueTextProps) {
  const segments = parseDialogueText(text);

  // Total character count across all segments
  const totalChars = segments.reduce((sum, seg) => sum + seg.text.length, 0);

  const [revealed, setRevealed] = useState(typewriter ? 0 : totalChars);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);
  const completedRef = useRef(!typewriter);

  // Skip to end when requested
  useEffect(() => {
    if (skipToEnd && revealed < totalChars) {
      cancelAnimationFrame(rafRef.current);
      setRevealed(totalChars);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }
  }, [skipToEnd, totalChars, onComplete, revealed]);

  // Reset when text changes
  useEffect(() => {
    if (!typewriter) {
      setRevealed(totalChars);
      completedRef.current = true;
      onComplete?.();
      return;
    }
    setRevealed(0);
    completedRef.current = false;
    startRef.current = performance.now();

    function tick(now: number) {
      const elapsed = (now - startRef.current) / 1000;
      const chars = Math.floor(elapsed * speed);
      if (chars >= totalChars) {
        setRevealed(totalChars);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
        return;
      }
      setRevealed(chars);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text, typewriter, speed, totalChars]);

  // Build visible text per segment
  let remaining = revealed;

  return (
    <>
      {segments.map((segment, index) => {
        if (remaining <= 0) return null;

        const visibleLen = Math.min(segment.text.length, remaining);
        const visibleText = segment.text.slice(0, visibleLen);
        remaining -= visibleLen;

        return (
          <span
            key={`${index}-${segment.text}`}
            className={`formatted-dialogue-text__segment${segment.narration ? " formatted-dialogue-text__segment--narration" : ""}`}
            style={segment.color ? { color: segment.color } : undefined}
          >
            {visibleText}
          </span>
        );
      })}
    </>
  );
}
