import { useMemo, useState } from "react";
import { useGame } from "../../GameContext";
import type { ChangelogEntry } from "../../data/changelog";

const CATEGORY_LABELS: Record<ChangelogEntry["category"], string> = {
  new: "New",
  changes: "Balance / Changes",
  ui: "UI / UX",
  fixes: "Fixes",
};

export function ChangelogPanel() {
  const { changelog } = useGame();
  const [open, setOpen] = useState(false);

  const releases = changelog?.releases ?? [];
  const visibleReleases = useMemo(() => releases.slice(0, 3), [releases]);

  if (visibleReleases.length === 0) {
    return null;
  }

  return (
    <div className="changelog-section">
      <div className="window-controls">
        <button
          type="button"
          className={`window-toggle ${open ? "is-open" : ""}`}
          onClick={() => setOpen((value) => !value)}
        >
          Changelog
        </button>
      </div>

      {open ? (
        <div className="window-panel changelog-panel">
          {visibleReleases.map((release) => {
            const grouped = release.entries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
              if (!acc[entry.category]) {
                acc[entry.category] = [];
              }
              acc[entry.category].push(entry);
              return acc;
            }, {});

            return (
              <section key={release.version} className="changelog-release">
                <div className="changelog-release-head">
                  <p className="changelog-release-version">{release.version}</p>
                  <p className="changelog-release-date">{release.date}</p>
                </div>
                {release.title ? (
                  <p className="changelog-release-title">{release.title}</p>
                ) : null}

                {(Object.keys(CATEGORY_LABELS) as ChangelogEntry["category"][]).map((category) => {
                  const entries = grouped[category];
                  if (!entries || entries.length === 0) {
                    return null;
                  }
                  return (
                    <div key={category} className="changelog-group">
                      <p className="changelog-group-label">{CATEGORY_LABELS[category]}</p>
                      <ul className="changelog-entry-list">
                        {entries.map((entry, index) => (
                          <li key={`${category}_${index}`}>{entry.text}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
