import { PageShell } from "../layout/PageShell";

interface Props {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: Props) {
  return (
    <PageShell title={title}>
      <div className="placeholder">
        <p className="placeholder-text">{description}</p>
        <p className="placeholder-hint">Coming in a future phase.</p>
      </div>
    </PageShell>
  );
}
