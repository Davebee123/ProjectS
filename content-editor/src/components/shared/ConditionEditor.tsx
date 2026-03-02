import { useEffect, useRef, useMemo } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import { linter, type Diagnostic } from "@codemirror/lint";
import { conditionLanguage } from "../../dsl/highlighting";
import { conditionCompletions, setEntityProviders } from "../../dsl/completions";
import { parse } from "../../dsl/parser";
import { useItemStore } from "../../stores/itemStore";
import { useSkillStore } from "../../stores/skillStore";
import { useStorageKeyStore } from "../../stores/storageKeyStore";
import { useStatusEffectStore } from "../../stores/statusEffectStore";
import { useWorldStore } from "../../stores/worldStore";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#2a2a2a",
    color: "#e0e0e0",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
    fontSize: "13px",
    fontFamily: '"Cascadia Code", "Fira Code", monospace',
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "#6b8a5e",
  },
  ".cm-content": {
    padding: "6px 10px",
    caretColor: "#e0e0e0",
    minHeight: "28px",
  },
  ".cm-line": {
    padding: 0,
  },
  ".cm-placeholder": {
    color: "#666666",
    fontStyle: "italic",
  },
  // Syntax colors
  ".cm-keyword": { color: "#c586c0" },
  ".cm-string": { color: "#ce9178" },
  ".cm-number": { color: "#b5cea8" },
  ".cm-bool": { color: "#569cd6" },
  ".cm-operator": { color: "#d4d4d4" },
  ".cm-punctuation": { color: "#808080" },
  ".cm-variableName": { color: "#9cdcfe" },
  ".cm-variableName.cm-special": { color: "#4ec9b0" },
  ".cm-function": { color: "#dcdcaa" },
  // Autocomplete
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "#252526",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete ul li": {
    color: "#e0e0e0",
    padding: "2px 8px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "#094771",
    color: "#ffffff",
  },
  ".cm-completionLabel": {
    fontSize: "13px",
  },
  ".cm-completionDetail": {
    fontSize: "11px",
    color: "#999999",
    marginLeft: "8px",
  },
  // Lint
  ".cm-lintRange-error": {
    backgroundImage: "none",
    borderBottom: "2px wavy #f44747",
  },
  ".cm-tooltip.cm-tooltip-lint": {
    backgroundColor: "#252526",
    border: "1px solid #3a3a3a",
    borderRadius: "4px",
    color: "#f44747",
    fontSize: "12px",
  },
  // Scrollbar
  ".cm-scroller": {
    overflow: "auto",
  },
  // Gutters off
  ".cm-gutters": {
    display: "none",
  },
});

const conditionLinter = linter((view) => {
  const text = view.state.doc.toString();
  if (!text.trim()) return [];

  const { errors } = parse(text);
  return errors.map(
    (err): Diagnostic => ({
      from: Math.min(err.start, text.length),
      to: Math.min(err.end, text.length),
      severity: "error",
      message: err.message,
    })
  );
});

export function ConditionEditor({ value, onChange, placeholder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Push entity data into the completion provider
  const items = useItemStore((s) => s.items);
  const skills = useSkillStore((s) => s.skills);
  const storageKeys = useStorageKeyStore((s) => s.storageKeys);
  const statusEffects = useStatusEffectStore((s) => s.statusEffects);
  const rooms = useWorldStore((s) => s.world.rooms);

  useMemo(() => {
    setEntityProviders({
      itemIds: items.map((i) => i.id),
      skillIds: skills.map((s) => s.id),
      storageKeyIds: storageKeys.map((k) => k.id),
      statusEffectIds: statusEffects.map((e) => e.id),
      roomIds: rooms.map((r) => r.id),
    });
  }, [items, skills, storageKeys, statusEffects, rooms]);

  // Create editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newVal = update.state.doc.toString();
        onChangeRef.current(newVal);
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        keymap.of(defaultKeymap),
        conditionLanguage,
        editorTheme,
        autocompletion({
          override: [conditionCompletions],
          activateOnTyping: true,
        }),
        conditionLinter,
        updateListener,
        EditorView.lineWrapping,
        cmPlaceholder(placeholder || 'e.g. player.has_item("golden_key") AND skill("mining").level >= 3'),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount — value sync handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} />;
}
