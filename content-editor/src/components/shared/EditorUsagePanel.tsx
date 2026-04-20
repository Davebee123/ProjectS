import { useNavigate } from "react-router-dom";

interface UsageLink {
  id: string;
  label: string;
  to: string;
  meta?: string;
}

interface UsageGroup {
  label: string;
  items: UsageLink[];
}

interface Props {
  title?: string;
  description?: string;
  groups: UsageGroup[];
}

export function EditorUsagePanel({
  title = "Used By",
  description = "Linked authored content that currently references this entity.",
  groups,
}: Props) {
  const navigate = useNavigate();
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <section className="editor-section">
      <h3 className="section-title">{title}</h3>
      <p className="section-desc">{description}</p>
      <div className="editor-usage-groups">
        {visibleGroups.map((group) => (
          <div key={group.label} className="editor-usage-group">
            <div className="editor-usage-group-title">{group.label}</div>
            <div className="editor-usage-list">
              {group.items.map((item) => (
                <button
                  key={`${group.label}-${item.id}`}
                  type="button"
                  className="editor-usage-link"
                  onClick={() => navigate(item.to)}
                >
                  <span className="editor-usage-link-main">
                    <strong>{item.label}</strong>
                    {item.meta ? <span>{item.meta}</span> : null}
                  </span>
                  <span className="editor-usage-link-id">{item.id}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
