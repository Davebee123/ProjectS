interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function VolumeSlider({
  label,
  value,
  onChange,
  disabled,
}: VolumeSliderProps) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div className="form-field" style={{ opacity: disabled ? 0.5 : 1 }}>
      <label className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(clamped * 100)}%
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
