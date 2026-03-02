import { NavLink } from "react-router-dom";
import { useHistoryStore } from "../../stores/historyStore";

const NAV_ITEMS = [
  { to: "/", label: "Tags" },
  { to: "/storage", label: "Storage Keys" },
  { to: "/status-effects", label: "Status Effects" },
  { to: "/items", label: "Items" },
  { to: "/skills", label: "Skills" },
  { to: "/combos", label: "Combos" },
  { to: "/interactables", label: "Interactables" },
  { to: "/world", label: "World Map" },
  { to: "/export", label: "Export / Import" },
  { to: "/test", label: "Test Conditions" },
  { to: "/dsl", label: "DSL Reference" },
];

export function Sidebar() {
  const past = useHistoryStore((s) => s.past);
  const future = useHistoryStore((s) => s.future);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Content Editor</h1>
        <span className="sidebar-subtitle">Incremental Fantasy RPG</span>
      </div>
      <div className="sidebar-undo-redo">
        <button
          className="btn btn--sm"
          disabled={past.length === 0}
          onClick={undo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="btn btn--sm"
          disabled={future.length === 0}
          onClick={redo}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>
      <ul className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " sidebar-link--active" : ""}`
              }
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
