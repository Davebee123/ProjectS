import { parseDialogueText } from "../../../../shared/content/dialogueText";

interface FormattedDialogueTextProps {
  text: string;
}

export function FormattedDialogueText({ text }: FormattedDialogueTextProps) {
  const segments = parseDialogueText(text);

  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text}`}
          className={`editor-formatted-dialogue-text__segment${segment.narration ? " editor-formatted-dialogue-text__segment--narration" : ""}`}
          style={segment.color ? { color: segment.color } : undefined}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}
