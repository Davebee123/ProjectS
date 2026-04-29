import { useMemo, useState } from "react";
import { useGame } from "../../GameContext";
import type { QuestCategory } from "../../data/loader";
import { getResolvedQuestsByCategory, getCompletedQuests, getActiveQuestTargets } from "../../state/quests";
import { ProgressBar } from "../shared/ProgressBar";

const CATEGORY_LABELS: Record<QuestCategory, string> = {
  main_story: "Main Story",
  side_quest: "Side Quests",
  task: "Tasks",
};

type QuestSection = QuestCategory | "completed";

const DEFAULT_OPEN: Record<QuestSection, boolean> = {
  main_story: true,
  side_quest: false,
  task: false,
  completed: false,
};

export function QuestBoard() {
  const { state } = useGame();
  const [openSections, setOpenSections] = useState<Record<QuestSection, boolean>>(DEFAULT_OPEN);

  const resolvedByCategory = useMemo(() => getResolvedQuestsByCategory(state), [state]);
  const completedQuests = useMemo(() => getCompletedQuests(state), [state]);
  const activeQuestTargets = useMemo(() => getActiveQuestTargets(state), [state]);

  return (
    <div className="quest-board">
      {(Object.keys(CATEGORY_LABELS) as QuestCategory[]).map((category) => {
        const entries = resolvedByCategory[category];
        const isOpen = openSections[category];
        return (
          <section key={category} className="quest-section">
            <button
              type="button"
              className="quest-category-header"
              onClick={() => setOpenSections((prev) => ({ ...prev, [category]: !prev[category] }))}
            >
              <span>{CATEGORY_LABELS[category]}</span>
              <span className="quest-category-chevron">{isOpen ? "▼" : "▶"}</span>
            </button>
            {isOpen ? (
              <div className="quest-category-body">
                {entries.length > 0 ? entries.map(({ quest, activeObjective }) => (
                  <article key={quest.id} className="quest-card">
                    <div className="quest-card-top">
                      <h3 className="quest-card-title">
                        {activeQuestTargets.questIds.has(quest.id) ? (
                          <span className="quest-bang quest-bang--inline" aria-label="Active quest step">!</span>
                        ) : null}
                        {quest.name}
                      </h3>
                      <div className="quest-card-level">
                        <span className="quest-card-level-label">Lvl</span>
                        <span className="quest-card-level-value">{quest.level}</span>
                      </div>
                    </div>
                    <div className="quest-card-middle">
                      <p className="quest-card-objective">
                        {activeObjective?.objective.title ?? "Quest objective pending"}
                      </p>
                      <p className="quest-card-description">
                        {activeObjective?.objective.description || quest.description}
                      </p>
                    </div>
                    <div className="quest-card-bottom">
                      {activeObjective?.progressValue !== undefined && activeObjective.progressMax !== undefined ? (
                        <div className="quest-card-progress-block">
                          <div className="quest-card-progress-row">
                            <span>{formatProgressHeader(activeObjective.progressLabel)}</span>
                            <span>{activeObjective.progressValue}/{activeObjective.progressMax}</span>
                          </div>
                          <ProgressBar
                            value={activeObjective.progressValue}
                            max={activeObjective.progressMax}
                            color="rgba(150, 150, 150, 0.92)"
                            height={8}
                            showValues={false}
                          />
                        </div>
                      ) : (
                        <p className="quest-card-progress">
                          {activeObjective?.progressText ?? "No progress details yet."}
                        </p>
                      )}
                    </div>
                  </article>
                )) : (
                  <p className="empty-text">No active {CATEGORY_LABELS[category].toLowerCase()}.</p>
                )}
              </div>
            ) : null}
          </section>
        );
      })}

      <section className="quest-section">
        <button
          type="button"
          className="quest-category-header"
          onClick={() => setOpenSections((prev) => ({ ...prev, completed: !prev.completed }))}
        >
          <span>Completed{completedQuests.length > 0 ? ` (${completedQuests.length})` : ""}</span>
          <span className="quest-category-chevron">{openSections.completed ? "▼" : "▶"}</span>
        </button>
        {openSections.completed ? (
          <div className="quest-category-body">
            {completedQuests.length > 0 ? completedQuests.map(({ quest }) => (
              <article key={quest.id} className="quest-card quest-card-completed">
                <div className="quest-card-top">
                  <h3 className="quest-card-title">{quest.name}</h3>
                  <div className="quest-card-level">
                    <span className="quest-card-level-label">Lvl</span>
                    <span className="quest-card-level-value">{quest.level}</span>
                  </div>
                </div>
                <div className="quest-card-middle">
                  <p className="quest-card-objective">Completed</p>
                  <p className="quest-card-description">
                    {quest.completedDescription || quest.description}
                  </p>
                </div>
              </article>
            )) : (
              <p className="empty-text">No completed quests yet.</p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatProgressHeader(label: string | undefined): string {
  const trimmed = label?.trim() || "Progress";
  return trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
}
