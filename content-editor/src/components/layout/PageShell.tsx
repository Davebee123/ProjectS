import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function PageShell({ title, children, actions }: Props) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h2 className="page-title">{title}</h2>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      <div className="page-content">{children}</div>
    </div>
  );
}
