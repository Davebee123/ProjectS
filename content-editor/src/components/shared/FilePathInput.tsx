import { useRef } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** accept attribute for the file input, e.g. "audio/*" or "image/*" */
  accept?: string;
  /** Directory prefix added to the filename when browsing, e.g. "audio" or "images/interactables" */
  pathPrefix?: string;
}

/**
 * Text input with a Browse button that opens a native file picker.
 * When a file is selected the field is populated with `<pathPrefix>/<filename>`.
 * The path is relative to `public/` — the user must ensure the file exists there.
 */
export function FilePathInput({
  label,
  value,
  onChange,
  placeholder,
  accept,
  pathPrefix,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleBrowse() {
    fileRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const prefix = pathPrefix ? pathPrefix.replace(/\/+$/, "") + "/" : "";
    onChange(prefix + file.name);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="form-field">
      <label className="field-label">{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="text-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button className="btn btn--sm" type="button" onClick={handleBrowse}>
          Browse
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
