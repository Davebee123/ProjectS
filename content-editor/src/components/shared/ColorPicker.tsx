interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: Props) {
  return (
    <div className="color-picker-field">
      {label && <label className="field-label">{label}</label>}
      <div className="color-picker-row">
        <input
          type="color"
          className="color-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="input input--sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 90, fontFamily: "monospace" }}
        />
      </div>
    </div>
  );
}
