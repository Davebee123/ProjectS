import type { ReactNode } from "react";

interface Props {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleEditorSection({ title, summary, defaultOpen = false, children }: Props) {
  return (
    <details className="editor-disclosure" open={defaultOpen}>
      <summary className="editor-disclosure-summary">
        <span className="editor-disclosure-title">{title}</span>
        <span className="editor-disclosure-meta">{summary}</span>
      </summary>
      <div className="editor-disclosure-body">{children}</div>
    </details>
  );
}
