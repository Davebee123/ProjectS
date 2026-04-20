import { NavLink } from "react-router-dom";
import { NAV_SECTIONS } from "../../navigation";
import { useHistoryStore } from "../../stores/historyStore";

interface SidebarProps {
  onOpenCommandPalette: () => void;
}

export function Sidebar({ onOpenCommandPalette }: SidebarProps) {
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
      <div className="sidebar-command">
        <button className="btn btn--sm sidebar-command-btn" onClick={onOpenCommandPalette}>
          Jump
          <span className="sidebar-command-shortcut">Ctrl+K</span>
        </button>
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
      <div className="sidebar-sections">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="sidebar-section">
            <div className="sidebar-section-title">{section.label}</div>
            <ul className="sidebar-nav sidebar-nav--compact">
              {section.items.map((item) => (
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
          </div>
        ))}
      </div>
    </nav>
  );
}
