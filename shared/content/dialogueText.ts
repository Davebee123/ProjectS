export interface DialogueTextSegment {
  text: string;
  narration: boolean;
  color?: string;
}

interface StyleFrame {
  tag: "root" | "narration" | "color";
  narration: boolean;
  color?: string;
}

function createTagPattern() {
  return /\[(\/?)(narration|color)(?:=(#[0-9a-fA-F]{3,8}))?\]/g;
}

function pushTextSegment(
  segments: DialogueTextSegment[],
  text: string,
  style: StyleFrame
) {
  if (!text) {
    return;
  }
  const previous = segments[segments.length - 1];
  if (
    previous &&
    previous.narration === style.narration &&
    previous.color === style.color
  ) {
    previous.text += text;
    return;
  }
  segments.push({
    text,
    narration: style.narration,
    color: style.color,
  });
}

export function stripDialogueMarkup(text: string): string {
  return text.replace(createTagPattern(), "");
}

export function parseDialogueText(text: string): DialogueTextSegment[] {
  const segments: DialogueTextSegment[] = [];
  const stack: StyleFrame[] = [{ tag: "root", narration: false }];
  let cursor = 0;

  for (const match of text.matchAll(createTagPattern())) {
    const index = match.index ?? 0;
    pushTextSegment(segments, text.slice(cursor, index), stack[stack.length - 1]);
    cursor = index + match[0].length;

    const isClosing = match[1] === "/";
    const tag = match[2] as "narration" | "color";
    const color = match[3];

    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
      continue;
    }

    const current = stack[stack.length - 1];
    if (tag === "narration") {
      stack.push({
        tag,
        narration: true,
        color: current.color,
      });
      continue;
    }

    if (tag === "color" && color) {
      stack.push({
        tag,
        narration: current.narration,
        color,
      });
    }
  }

  pushTextSegment(segments, text.slice(cursor), stack[stack.length - 1]);
  return segments;
}
