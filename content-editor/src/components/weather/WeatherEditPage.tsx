import { useParams, useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { FilePathInput } from "../shared/FilePathInput";
import { useWeatherStore } from "../../stores/weatherStore";

export function WeatherEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const weather = useWeatherStore((s) => s.weathers.find((w) => w.id === id));
  const updateWeather = useWeatherStore((s) => s.updateWeather);

  if (!weather) {
    return (
      <PageShell title="Weather Not Found">
        <p className="empty-text">No weather with ID "{id}".</p>
        <button className="btn" onClick={() => navigate("/weather")}>
          Back to list
        </button>
      </PageShell>
    );
  }

  const patch = (p: Parameters<typeof updateWeather>[1]) =>
    updateWeather(weather.id, p);

  return (
    <PageShell title={weather.name}>
      <button className="btn btn--sm" onClick={() => navigate("/weather")}>
        &larr; Back
      </button>

      <section className="editor-section" style={{ marginTop: 16 }}>
        <h3 className="section-title">General</h3>
        <div className="field-grid">
          <label className="field-label">ID</label>
          <input className="input" value={weather.id} disabled />

          <label className="field-label">Name</label>
          <input
            className="input"
            value={weather.name}
            onChange={(e) => patch({ name: e.target.value })}
          />

          <label className="field-label">Description</label>
          <textarea
            className="input"
            rows={2}
            value={weather.description}
            onChange={(e) => patch({ description: e.target.value })}
          />

          <label className="field-label">Icon</label>
          <input
            className="input"
            value={weather.icon}
            onChange={(e) => patch({ icon: e.target.value })}
            placeholder="Emoji or symbol"
            style={{ maxWidth: 100 }}
          />

          <label className="field-label">Weight</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              className="input"
              value={weather.weight}
              min={0}
              step={1}
              onChange={(e) => patch({ weight: Math.max(0, Number(e.target.value)) })}
              style={{ maxWidth: 80 }}
            />
            <span className="field-hint">Higher = more likely to appear</span>
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Gameplay Modifiers</h3>
        <div className="field-grid">
          <label className="field-label">Energy Regen Multiplier</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              className="input"
              value={weather.energyRegenMult}
              min={0}
              step={0.05}
              onChange={(e) => patch({ energyRegenMult: Number(e.target.value) })}
              style={{ maxWidth: 100 }}
            />
            <span className="field-hint">{(weather.energyRegenMult * 100).toFixed(0)}%</span>
          </div>

          <label className="field-label">Mana Regen Multiplier</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              className="input"
              value={weather.manaRegenMult}
              min={0}
              step={0.05}
              onChange={(e) => patch({ manaRegenMult: Number(e.target.value) })}
              style={{ maxWidth: 100 }}
            />
            <span className="field-hint">{(weather.manaRegenMult * 100).toFixed(0)}%</span>
          </div>

          <label className="field-label">Success Chance Modifier</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              className="input"
              value={weather.successChanceMod}
              step={1}
              onChange={(e) => patch({ successChanceMod: Number(e.target.value) })}
              style={{ maxWidth: 100 }}
            />
            <span className="field-hint">Added to success % (negative = harder)</span>
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h3 className="section-title">Ambient Sound</h3>
        <div className="field-grid">
          <label className="field-label">Sound File</label>
          <FilePathInput
            label=""
            value={weather.ambientSound ?? ""}
            onChange={(v) => patch({ ambientSound: v || undefined })}
            placeholder="/Sound Files/rain-ambient.mp3"
            accept="audio/*"
            pathPrefix="Sound Files"
          />

          <label className="field-label">Volume</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weather.ambientSoundVolume ?? 1}
              onChange={(e) => patch({ ambientSoundVolume: Number(e.target.value) })}
              style={{ maxWidth: 160 }}
            />
            <span className="field-hint">
              {((weather.ambientSoundVolume ?? 1) * 100).toFixed(0)}%
            </span>
          </div>

          <label className="field-label">Loop</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={weather.ambientSoundLoop !== false}
              onChange={(e) => patch({ ambientSoundLoop: e.target.checked })}
            />
            <span className="field-hint">Loop sound continuously</span>
          </label>
        </div>
      </section>
    </PageShell>
  );
}
