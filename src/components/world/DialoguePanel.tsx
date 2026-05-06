import { useMemo } from "react";
import { useGame } from "../../GameContext";
import { getDialogueDef } from "../../data/loader";
import { getInteractableDisplayImageSrc, getInteractableImageObjectPosition } from "./interactableImage";

interface DialoguePanelProps {
  inline?: boolean;
}

export function DialoguePanel({ inline = false }: DialoguePanelProps) {
  const { state } = useGame();

  const session = state.activeDialogue;
  const object = useMemo(
    () => (session?.objectId ? state.objects.find((entry) => entry.id === session.objectId) ?? null : null),
    [state.objects, session?.objectId]
  );

  const dialogue = session ? getDialogueDef(session.dialogueId) : undefined;
  const node = dialogue?.nodes.find((entry) => entry.id === session?.nodeId);

  if (!session || !dialogue || !node) {
    return null;
  }

  const speakerName = object?.name || session.speakerName || dialogue.name;
  const portraitImage = object ? getInteractableDisplayImageSrc(object) : session.portraitImage;
  const portraitObjectPosition = object
    ? getInteractableImageObjectPosition(object.imagePositionX, object.imagePositionY)
    : getInteractableImageObjectPosition(session.portraitImagePositionX, session.portraitImagePositionY);
  const portraitObjectFit = object ? "cover" : session.portraitImageFit ?? "cover";
  const meterLabel = object?.meterLabel || session.meterLabel;
  const integrity = object ? Math.ceil(object.integrity) : session.integrity;
  const maxIntegrity = object?.maxIntegrity ?? session.maxIntegrity;

  return (
    <div className={`dialogue-stack ${inline ? "dialogue-stack--inline" : ""}`}>
      <article className="dialogue-card">
        <div className="dialogue-card-header">
          <span className="dialogue-card-name">{speakerName}</span>
          {meterLabel && integrity !== undefined && maxIntegrity !== undefined ? (
            <span className="dialogue-card-meter">
              {integrity} / {maxIntegrity} {meterLabel}
            </span>
          ) : null}
        </div>

        <div className="dialogue-card-portrait">
          {portraitImage ? (
            <img
              src={portraitImage}
              alt={speakerName}
              style={{
                objectPosition: portraitObjectPosition,
                objectFit: portraitObjectFit,
              }}
            />
          ) : (
            <div className="dialogue-card-portrait-empty" />
          )}
        </div>
      </article>
    </div>
  );
}
