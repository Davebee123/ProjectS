import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { useItemStore, createDefaultItem } from "../../stores/itemStore";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function ItemListPage() {
  const { items, addItem, removeItem } = useItemStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [stackableFilter, setStackableFilter] = useState("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const slotOptions = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.slot).filter(Boolean))) as string[];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
      }
      if (slotFilter === "") {
        if (item.slot !== undefined) return false;
      } else if (slotFilter !== "all") {
        if (item.slot !== slotFilter) return false;
      }
      if (stackableFilter === "yes" && !item.stackable) return false;
      if (stackableFilter === "no" && item.stackable) return false;
      return true;
    });
  }, [items, search, slotFilter, stackableFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of filtered) {
      const key = item.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "(Ungrouped)") return 1;
      if (b === "(Ungrouped)") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const toggleFolder = (name: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    if (items.some((i) => i.id === id)) return;
    addItem(createDefaultItem(id, name));
    setNewName("");
    navigate(`/items/${id}`);
  };

  return (
    <PageShell title="Items">
      <section className="editor-section">
        <p className="section-desc">
          Define item templates — equipment, consumables, and materials.
        </p>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input select"
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
          >
            <option value="all">All Slots</option>
            <option value="">No Slot</option>
            {slotOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="input select"
            value={stackableFilter}
            onChange={(e) => setStackableFilter(e.target.value)}
          >
            <option value="all">Stackable: All</option>
            <option value="yes">Stackable: Yes</option>
            <option value="no">Stackable: No</option>
          </select>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Slot</th>
              <th>Stackable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([folderName, groupItems]) => {
              const collapsed = collapsedFolders.has(folderName);
              return (
                <React.Fragment key={folderName}>
                  <tr>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>▶</span>
                        {folderName}
                        <span className="folder-count">({groupItems.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed && groupItems.map((item) => (
                    <tr key={item.id}>
                      <td className="cell-id">{item.id}</td>
                      <td>
                        <button className="link-btn" onClick={() => navigate(`/items/${item.id}`)}>
                          {item.name}
                        </button>
                      </td>
                      <td>{item.slot || "—"}</td>
                      <td>{item.stackable ? "Yes" : "No"}</td>
                      <td>
                        <button className="btn btn--danger btn--sm" onClick={() => removeItem(item.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="add-row">
          <input
            type="text"
            placeholder="New item name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="input"
          />
          <button className="btn btn--primary" onClick={handleAdd}>
            Add Item
          </button>
        </div>
      </section>
    </PageShell>
  );
}
