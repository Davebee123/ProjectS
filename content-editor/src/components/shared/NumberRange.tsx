interface Props {
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  label?: string;
}

export function NumberRange({ min, max, onMinChange, onMaxChange, label }: Props) {
  return (
    <div className="number-range">
      {label && <label className="field-label">{label}</label>}
      <div className="number-range-row">
        <input
          type="number"
          className="input input--sm"
          value={min}
          onChange={(e) => onMinChange(Number(e.target.value))}
        />
        <span className="range-sep">—</span>
        <input
          type="number"
          className="input input--sm"
          value={max}
          onChange={(e) => onMaxChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
