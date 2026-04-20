import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultAffix, useItemizationStore } from "../../stores/itemizationStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function AffixListPage() {
  const { affixes, addAffix, removeAffix } = useItemizationStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const filtered = useMemo(
    () =>
      affixes.filter((affix) => {
        if (search) {
          const q = search.toLowerCase();
          if (!affix.id.toLowerCase().includes(q) && !affix.nameTemplate.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (kindFilter !== "all" && affix.kind !== kindFilter) return false;
        return true;
      }),
    [affixes, search, kindFilter]
  );

  return (
    <PageShell title="Affixes">
      <section className="editor-section">
        <p className="section-desc">
          Author prefix and suffix definitions, tier ranges, and modifier payloads for rolled gear.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search affix id or name..."
          />
          <select className="input select" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="all">All Kinds</option>
            <option value="prefix">Prefix</option>
            <option value="suffix">Suffix</option>
          </select>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name Template</th>
              <th>Kind</th>
              <th>Table</th>
              <th>Tiers</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((affix) => (
              <tr key={affix.id}>
                <td className="cell-id">{affix.id}</td>
                <td>
                  <button className="link-btn" onClick={() => navigate(`/itemization/affixes/${affix.id}`)}>
                    {affix.nameTemplate}
                  </button>
                </td>
                <td>{affix.kind}</td>
                <td>{affix.tableId}</td>
                <td>{affix.tiers.length}</td>
                <td>
                  <button className="btn btn--danger btn--sm" onClick={() => removeAffix(affix.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="add-row">
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New affix name template..."
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              const label = newName.trim();
              if (!label) return;
              const id = slugify(label);
              if (affixes.some((entry) => entry.id === id)) return;
              addAffix(createDefaultAffix(id, label));
              setNewName("");
              navigate(`/itemization/affixes/${id}`);
            }}
          >
            Add Affix
          </button>
        </div>
      </section>
    </PageShell>
  );
}
