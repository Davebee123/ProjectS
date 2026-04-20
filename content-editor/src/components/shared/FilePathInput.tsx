import { useEffect, useMemo, useRef, useState } from "react";
import { listPublicAssets, loadPublicAssets } from "../../utils/publicAssets";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assetsVersion, setAssetsVersion] = useState(0);

  // Load the dynamic asset list when the picker opens, and on mount for first paint.
  useEffect(() => {
    let cancelled = false;
    loadPublicAssets().then(() => {
      if (!cancelled) setAssetsVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const assetOptions = useMemo(
    () =>
      listPublicAssets({
        accept,
        pathPrefix,
        query: query || value,
      }).slice(0, 60),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accept, pathPrefix, query, value, assetsVersion]
  );

  useEffect(() => {
    if (!open) {
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

  function handleBrowse() {
    fileRef.current?.click();
  }

  function normalizeTypedPath(rawValue: string): string {
    const trimmed = rawValue.trim();
    if (!trimmed || /^[a-z]+:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (!pathPrefix || withLeadingSlash.slice(1).includes("/")) {
      return withLeadingSlash.replace(/\/+/g, "/");
    }

    const prefix = pathPrefix.replace(/^\/+|\/+$/g, "");
    return `/${prefix}${withLeadingSlash}`.replace(/\/+/g, "/");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const prefix = pathPrefix ? pathPrefix.replace(/\/+$/, "") + "/" : "";
    onChange(`/${prefix}${file.name}`.replace(/\/+/g, "/"));
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="form-field">
      <label className="field-label">{label}</label>
      <div ref={rootRef} className="asset-input">
        <div className="asset-input-row">
          <input
            className="text-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              const normalized = normalizeTypedPath(e.target.value);
              if (normalized !== value) {
                onChange(normalized);
              }
            }}
            placeholder={placeholder}
            style={{ flex: 1 }}
          />
          <button
            className={`btn btn--sm${open ? " is-active" : ""}`}
            type="button"
            onClick={() => {
              setOpen((current) => {
                const next = !current;
                if (next) {
                  // Refresh manifest so newly-added folders/files show up.
                  loadPublicAssets(true).then(() => setAssetsVersion((v) => v + 1));
                }
                return next;
              });
              setQuery("");
            }}
          >
            Pick
          </button>
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
        {open ? (
          <div className="asset-picker-panel">
            <input
              autoFocus
              className="input asset-picker-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search public assets..."
            />
            <div className="asset-picker-options">
              {assetOptions.length === 0 ? (
                <div className="asset-picker-empty">No matching assets in <code>public/</code>.</div>
              ) : (
                assetOptions.map((option) => (
                  <button
                    key={option.path}
                    type="button"
                    className={`asset-picker-option${option.path === value ? " is-selected" : ""}`}
                    onClick={() => {
                      onChange(option.path);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="asset-picker-option-label">{option.label}</span>
                    <span className="asset-picker-option-meta">{option.meta}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
