import { useEffect, useMemo, useRef, useState } from "react";

export interface ReferencePickerOption {
  id: string;
  label: string;
  meta?: string;
  description?: string;
  badges?: string[];
}

interface ReferencePickerProps {
  label?: string;
  value: string;
  options: ReferencePickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  noneLabel?: string;
  compact?: boolean;
  showSelectedPreview?: boolean;
  disabled?: boolean;
  onOpenSelected?: (value: string) => void;
  onCreate?: (name: string) => string | void;
  createLabel?: string;
  createPlaceholder?: string;
}

export function ReferencePicker({
  label,
  value,
  options,
  onChange,
  placeholder = "Select reference...",
  noneLabel = "(none)",
  compact = false,
  showSelectedPreview = !compact,
  disabled = false,
  onOpenSelected,
  onCreate,
  createLabel = "Create + Link",
  createPlaceholder = "New reference name...",
}: ReferencePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = options.slice().sort((a, b) => a.label.localeCompare(b.label));
    if (!normalized) {
      return sorted;
    }
    return sorted.filter((option) =>
      `${option.label} ${option.id} ${option.meta ?? ""} ${option.description ?? ""} ${(option.badges ?? []).join(" ")}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setCreateName("");
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className={label ? "form-field" : undefined}>
      {label ? <label className="field-label">{label}</label> : null}
      <div ref={rootRef} className={`reference-picker${compact ? " reference-picker--compact" : ""}`}>
        <div className="reference-picker-row">
          <button
            type="button"
            className={`reference-picker-trigger${open ? " is-open" : ""}`}
            onClick={() => {
              if (disabled) {
                return;
              }
              setOpen((current) => !current);
              setQuery("");
            }}
            disabled={disabled}
          >
            <span className={`reference-picker-value${selected ? "" : " is-placeholder"}`}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="reference-picker-chevron">{open ? "▲" : "▼"}</span>
          </button>
          {value && !compact ? (
            <>
              {onOpenSelected ? (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onOpenSelected(value)}
                >
                  Open
                </button>
              ) : null}
              <button type="button" className="btn btn--sm" onClick={() => onChange("")}>
                Clear
              </button>
            </>
          ) : null}
        </div>

        {showSelectedPreview && selected ? (
          <div className="reference-picker-preview">
            {selected.meta ? <div className="reference-picker-meta">{selected.meta}</div> : null}
            {selected.badges && selected.badges.length > 0 ? (
              <div className="reference-picker-badges">
                {selected.badges.map((badge) => (
                  <span key={badge} className="editor-badge editor-badge--neutral">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
            {selected.description ? (
              <div className="reference-picker-description">{selected.description}</div>
            ) : null}
          </div>
        ) : null}

        {open ? (
          <div className="reference-picker-panel">
            <input
              autoFocus
              className="input reference-picker-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
            />
            <div className="reference-picker-options">
              <button
                type="button"
                className={`reference-picker-option${!value ? " is-selected" : ""}`}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <span className="reference-picker-option-label">{noneLabel}</span>
              </button>
              {filteredOptions.length === 0 ? (
                <div className="reference-picker-empty">No matches.</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`reference-picker-option${option.id === value ? " is-selected" : ""}`}
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                  >
                    <span className="reference-picker-option-label">{option.label}</span>
                    {option.meta ? <span className="reference-picker-option-meta">{option.meta}</span> : null}
                  </button>
                ))
              )}
            </div>
            {onCreate ? (
              <div className="reference-picker-create">
                {!creating ? (
                  <button
                    type="button"
                    className="btn btn--sm reference-picker-create-toggle"
                    onClick={() => {
                      setCreating(true);
                      setCreateName(query.trim());
                    }}
                  >
                    {createLabel}
                  </button>
                ) : (
                  <div className="reference-picker-create-form">
                    <input
                      className="input input--sm"
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder={createPlaceholder}
                    />
                    <div className="reference-picker-create-actions">
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={!createName.trim()}
                        onClick={() => {
                          const createdId = onCreate(createName.trim());
                          if (!createdId) {
                            return;
                          }
                          onChange(createdId);
                          setOpen(false);
                          setCreating(false);
                          setCreateName("");
                          setQuery("");
                        }}
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => {
                          setCreating(false);
                          setCreateName("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
