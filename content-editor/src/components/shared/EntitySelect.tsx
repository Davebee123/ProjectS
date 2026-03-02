interface EntityOption {
  id: string;
  name: string;
}

interface Props {
  entities: EntityOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
}

export function EntitySelect({ entities, value, onChange, label, placeholder }: Props) {
  return (
    <div className="entity-select">
      {label && <label className="field-label">{label}</label>}
      <select
        className="input select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder || "-- Select --"}</option>
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({e.id})
          </option>
        ))}
      </select>
    </div>
  );
}
