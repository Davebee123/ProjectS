import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import {
  useWeatherStore,
  createDefaultWeather,
} from "../../stores/weatherStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function WeatherListPage() {
  const { weathers, addWeather, removeWeather } = useWeatherStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return weathers;
    const q = search.toLowerCase();
    return weathers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q)
    );
  }, [weathers, search]);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (weathers.some((w) => w.id === id)) return;
    addWeather(createDefaultWeather(id, name));
    setNewName("");
    navigate(`/weather/${id}`);
  };

  return (
    <PageShell title="Weather">
      <section className="editor-section">
        <p className="section-desc">
          Define weather types with gameplay modifiers and ambient sounds.
          Weather is assigned per room based on seed and weights.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Icon</th>
              <th>Name</th>
              <th>Weight</th>
              <th>Energy</th>
              <th>Mana</th>
              <th>Success</th>
              <th>Sound</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id}>
                <td className="cell-id">{w.id}</td>
                <td style={{ fontSize: 18, textAlign: "center" }}>{w.icon || "?"}</td>
                <td>
                  <button
                    className="link-btn"
                    onClick={() => navigate(`/weather/${w.id}`)}
                  >
                    {w.name}
                  </button>
                </td>
                <td>{w.weight}</td>
                <td>{(w.energyRegenMult * 100).toFixed(0)}%</td>
                <td>{(w.manaRegenMult * 100).toFixed(0)}%</td>
                <td>{w.successChanceMod >= 0 ? `+${w.successChanceMod}` : w.successChanceMod}</td>
                <td>{w.ambientSound ? "\u266B" : "\u2014"}</td>
                <td>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => removeWeather(w.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New weather name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Weather
          </button>
        </div>
      </section>
    </PageShell>
  );
}
