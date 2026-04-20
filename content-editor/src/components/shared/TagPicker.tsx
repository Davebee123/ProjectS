interface TagOption {
  id: string;
  label: string;
  color?: string;
}

interface Props {
  tags: TagOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
}

export function TagPicker({ tags, selected, onChange, label }: Props) {
  const knownTagIds = new Set(tags.map((tag) => tag.id));
  const visibleSelected = selected.filter((id) => knownTagIds.has(id));

  const toggle = (id: string) => {
    if (visibleSelected.includes(id)) {
      onChange(visibleSelected.filter((s) => s !== id));
    } else {
      onChange([...visibleSelected, id]);
    }
  };

  return (
    <div className="tag-picker">
      {label && <label className="field-label">{label}</label>}
      <div className="tag-chips">
        {tags.map((tag) => {
          const active = visibleSelected.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={`tag-chip${active ? " tag-chip--active" : ""}`}
              style={
                active && tag.color
                  ? { borderColor: tag.color, backgroundColor: tag.color + "33" }
                  : undefined
              }
              onClick={() => toggle(tag.id)}
            >
              {tag.label}
            </button>
          );
        })}
        {tags.length === 0 && (
          <span className="tag-empty">No tags defined yet</span>
        )}
      </div>
    </div>
  );
}

interface SingleTagPickerProps {
  tags: TagOption[];
  selected: string;
  onChange: (selected: string) => void;
  label?: string;
}

export function SingleTagPicker({ tags, selected, onChange, label }: SingleTagPickerProps) {
  return (
    <div className="tag-picker">
      {label && <label className="field-label">{label}</label>}
      <select
        className="input select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Select --</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.label}
          </option>
        ))}
      </select>
    </div>
  );
}
