import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../layout/PageShell";
import { createDefaultItem, useItemStore } from "../../stores/itemStore";
import type { ItemTemplate } from "../../schema/types";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function makeUniqueId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) {
    return base;
  }
  let index = 2;
  while (existing.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

function duplicateItem(source: ItemTemplate, items: ItemTemplate[]): ItemTemplate {
  const existingIds = new Set(items.map((item) => item.id));
  const nextId = makeUniqueId(`${source.id}_copy`, existingIds);
  return {
    ...source,
    id: nextId,
    name: `${source.name} Copy`,
  };
}

export function ItemListPage() {
  const { items, addItem, removeItem } = useItemStore();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [stackableFilter, setStackableFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const slotOptions = useMemo(() => Array.from(new Set(items.map((item) => item.slot).filter(Boolean))) as string[], [items]);
  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.inventoryCategory).filter(Boolean))) as string[],
    [items]
  );
  const rarityOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.rarity).filter(Boolean))) as string[],
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.folder ?? "").toLowerCase().includes(q);
      if (!matchesSearch) {
        return false;
      }
      if (slotFilter === "") {
        if (item.slot !== undefined) return false;
      } else if (slotFilter !== "all") {
        if (item.slot !== slotFilter) return false;
      }
      if (stackableFilter === "yes" && !item.stackable) return false;
      if (stackableFilter === "no" && item.stackable) return false;
      if (categoryFilter !== "all" && (item.inventoryCategory || "") !== categoryFilter) return false;
      if (rarityFilter !== "all" && (item.rarity || "common") !== rarityFilter) return false;
      return true;
    });
  }, [categoryFilter, items, rarityFilter, search, slotFilter, stackableFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const key = item.folder?.trim() || "(Ungrouped)";
      if (!map.has(key)) {
        map.set(key, []);
      }
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
    if (items.some((item) => item.id === id)) return;
    addItem(createDefaultItem(id, name));
    setNewName("");
    navigate(`/items/${id}`);
  };

  const handleDuplicate = (item: ItemTemplate) => {
    const duplicate = duplicateItem(item, items);
    addItem(duplicate);
    navigate(`/items/${duplicate.id}`);
  };

  return (
    <PageShell title="Items">
      <section className="editor-section">
        <p className="section-desc">Define item templates for equipment, consumables, and materials.</p>
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search name, ID, or folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input select" value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)}>
            <option value="all">Slot: All</option>
            <option value="">No Slot</option>
            {slotOptions.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          <select className="input select" value={stackableFilter} onChange={(e) => setStackableFilter(e.target.value)}>
            <option value="all">Stackable: All</option>
            <option value="yes">Stackable: Yes</option>
            <option value="no">Stackable: No</option>
          </select>
          <select className="input select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Category: All</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select className="input select" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
            <option value="all">Rarity: All</option>
            {rarityOptions.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
        </div>
        <table className="editor-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Rarity</th>
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
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div className="folder-header" onClick={() => toggleFolder(folderName)}>
                        <span className={`folder-chevron${collapsed ? "" : " folder-chevron--open"}`}>{">"}</span>
                        {folderName}
                        <span className="folder-count">({groupItems.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed &&
                    groupItems
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="cell-id">{item.id}</td>
                          <td>
                            <button className="link-btn" onClick={() => navigate(`/items/${item.id}`)}>
                              {item.name}
                            </button>
                          </td>
                          <td>{item.inventoryCategory || "misc"}</td>
                          <td>{item.rarity || "common"}</td>
                          <td>{item.slot || "-"}</td>
                          <td>{item.stackable ? "Yes" : "No"}</td>
                          <td>
                            <div className="entity-row-actions">
                              <button className="btn btn--sm" onClick={() => handleDuplicate(item)}>
                                Duplicate
                              </button>
                              <button className="btn btn--danger btn--sm" onClick={() => removeItem(item.id)}>
                                Remove
                              </button>
                            </div>
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
