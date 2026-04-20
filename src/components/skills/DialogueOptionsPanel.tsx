import { useMemo, useState, useCallback, useEffect } from "react";
import { useGame } from "../../GameContext";
import { getDialogueDef } from "../../data/loader";
import { buildEvalContext } from "../../state";
import { evaluateCondition } from "../../data/evaluator";
import { FormattedDialogueText } from "../shared/FormattedDialogueText";

export function DialogueOptionsPanel() {
  const { state, dispatch } = useGame();

  const session = state.activeDialogue;
  const dialogue = session ? getDialogueDef(session.dialogueId) : undefined;
  const node = dialogue?.nodes.find((entry) => entry.id === session?.nodeId);
  const ctx = useMemo(() => buildEvalContext(state), [state]);
  const speakerName = useMemo(() => {
    if (!session || !dialogue) {
      return "";
    }
    const object = session.objectId
      ? state.objects.find((entry) => entry.id === session.objectId) ?? null
      : null;
    return object?.name || session.speakerName || dialogue.name;
  }, [dialogue, session, state.objects]);

  const visibleOptions = useMemo(() => {
    if (!node) {
      return [];
    }
    return node.options.filter((option) => !option.condition || evaluateCondition(option.condition, ctx));
  }, [ctx, node]);

  // Track typewriter completion per node
  const [textDone, setTextDone] = useState(false);
  const [skipRequested, setSkipRequested] = useState(false);

  // Reset when node changes
  useEffect(() => {
    setTextDone(false);
    setSkipRequested(false);
  }, [node?.id]);

  const handleTextComplete = useCallback(() => {
    setTextDone(true);
  }, []);

  const handleDialogueClick = useCallback(() => {
    if (!textDone) {
      setSkipRequested(true);
    }
  }, [textDone]);

  if (!session || !dialogue || !node) {
    return null;
  }

  if (visibleOptions.length === 0) {
    const label = node.continueLabel || (node.nextNodeId ? "Continue" : "End Conversation");
    return (
      <div className="dialogue-response-panel">
        <div
          className="dialogue-current-line-panel dialogue-clickable"
          onClick={handleDialogueClick}
        >
          <p className="dialogue-current-line-speaker">{speakerName}</p>
          <p className="dialogue-current-line-text">
            <FormattedDialogueText
              text={node.text}
              typewriter
              speed={40}
              onComplete={handleTextComplete}
              skipToEnd={skipRequested}
            />
          </p>
        </div>
        <button
          type="button"
          className={`dialogue-option dialogue-option--single${textDone ? " dialogue-option--visible" : " dialogue-option--hidden"}`}
          onClick={() => dispatch({ type: "ADVANCE_DIALOGUE" })}
          disabled={!textDone}
        >
          <span className="dialogue-option-index">1</span>
          <span className="dialogue-option-text">
            <FormattedDialogueText text={label} />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="dialogue-response-panel">
      <div
        className="dialogue-current-line-panel dialogue-clickable"
        onClick={handleDialogueClick}
      >
        <p className="dialogue-current-line-speaker">{speakerName}</p>
        <p className="dialogue-current-line-text">
          <FormattedDialogueText
            text={node.text}
            typewriter
            speed={40}
            onComplete={handleTextComplete}
            skipToEnd={skipRequested}
          />
        </p>
      </div>
      {visibleOptions.map((option, index) => (
        <button
          key={option.id}
          type="button"
          className={`dialogue-option${textDone ? " dialogue-option--visible" : " dialogue-option--hidden"}`}
          onClick={() => dispatch({ type: "CHOOSE_DIALOGUE_OPTION", optionId: option.id })}
          disabled={!textDone}
        >
          <span className="dialogue-option-index">{index + 1}</span>
          <span className="dialogue-option-text">
            <FormattedDialogueText text={option.text} />
          </span>
        </button>
      ))}
    </div>
  );
}
