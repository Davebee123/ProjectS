import type { ItemRarity } from "../../schema/types";
import { toPublicAssetPath } from "../../utils/assets";

export interface EditorItemPreviewRow {
  label: string;
  value: string;
}

interface EditorItemPreviewProps {
  name: string;
  description: string;
  additionalEffectsText?: string;
  image?: string;
  rarity?: ItemRarity;
  meta: string[];
  rows: EditorItemPreviewRow[];
}

export function EditorItemPreview({
  name,
  description,
  additionalEffectsText,
  image,
  rarity = "common",
  meta,
  rows,
}: EditorItemPreviewProps) {
  const assetPath = toPublicAssetPath(image);

  return (
    <div className="editor-item-preview-card">
      <div className="editor-item-preview-top">
        <div className="editor-item-preview-thumb">
          {assetPath ? (
            <img className="editor-item-preview-thumb-image" src={assetPath} alt={name} />
          ) : (
            <span className="editor-item-preview-thumb-empty">No Image</span>
          )}
        </div>
        <div className="editor-item-preview-main">
          <div className="editor-item-preview-heading">
            <strong>{name || "Unnamed Item"}</strong>
            <span className={`editor-item-rarity editor-item-rarity--${rarity}`}>{rarity}</span>
          </div>
          <div className="editor-item-preview-meta">{meta.filter(Boolean).join(" / ")}</div>
        </div>
      </div>
      {description ? <p className="editor-item-preview-description">{description}</p> : null}
      {rows.length > 0 ? (
        <div className="editor-item-preview-stats">
          {rows.map((row) => (
            <div key={`${row.label}-${row.value}`} className="editor-item-preview-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {additionalEffectsText ? (
        <div className="editor-item-preview-effects">
          <span className="editor-item-preview-effects-label">Additional Effects</span>
          <p>{additionalEffectsText}</p>
        </div>
      ) : null}
    </div>
  );
}
