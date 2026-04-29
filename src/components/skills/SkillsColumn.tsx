import { useEffect, useRef, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../../GameContext";
import type { QuestReceiptCue } from "../../state";
import { SkillBar } from "./SkillBar";
import { QuestBoard } from "./QuestBoard";
import { BackpackBoard } from "./BackpackBoard";
import { CraftingBoard } from "./CraftingBoard";
import { BioboardPanel } from "./BioboardPanel";
import { InteractableAbilitiesPanel } from "./InteractableAbilitiesPanel";
import { DialogueOptionsPanel } from "./DialogueOptionsPanel";
import {
  selectSkillFloatMap,
} from "../../state";
import { getVisibleQuestIds } from "../../state/quests";

const PASSIVES_PER_PAGE = 4;

function QuestReceiptOverlay({
  anchorRef,
  cues,
  now,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  cues: QuestReceiptCue[];
  now: number;
}) {
  const [pos, setPos] = useState({ left: 0, width: 0 });

  useEffect(() => {
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({ left: rect.left, width: rect.width });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef]);

  return (
    <div
      className="quest-receipt-dropdown"
      aria-live="polite"
      style={{ bottom: 16, left: pos.left, width: pos.width }}
    >
      {cues.map((cue) => (
        <div key={cue.id} className="loot-receipt-popup quest-receipt-popup">
          <div className="loot-receipt-header">
            <p className="loot-receipt-title">QUEST ADDED</p>
          </div>
          <div className="quest-receipt-body">
            <p className="quest-receipt-name">{cue.name}</p>
            <div className="quest-receipt-description-box">
              <p className="quest-receipt-description">{cue.description}</p>
            </div>
          </div>
          <div className="timed-popup-progress">
            <div
              className="timed-popup-progress-fill"
              style={{
                width: `${Math.max(0, Math.min(100, ((cue.expiresAt - now) / Math.max(1, cue.expiresAt - cue.appearsAt)) * 100))}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
const MIDDLE_TABS = [
  { id: "quests", label: "Quests" },
  { id: "backpack", label: "Backpack" },
  { id: "passives", label: "Passives" },
  { id: "abilities", label: "Abilities" },
  { id: "crafting", label: "Crafting" },
  { id: "bioboard", label: "Bioboard" },
] as const;

type MiddleTab = (typeof MIDDLE_TABS)[number]["id"];

const PLACEHOLDER_COPY: Record<string, string> = {};

export function SkillsColumn() {
  const { state, dispatch } = useGame();
  const [passivePage, setPassivePage] = useState(0);
  const [activeTab, setActiveTab] = useState<MiddleTab>("quests");

  const passiveSkills = useMemo(
    () => state.skills.filter((s) => s.kind === "passive"),
    [state.skills]
  );

  const skillFloatMap = useMemo(() => selectSkillFloatMap(state), [state.floatTexts]);

  const selectedObject = useMemo(
    () => state.objects.find((object) => object.id === state.selectedObjectId) ?? null,
    [state.objects, state.selectedObjectId]
  );
  const tabAreaRef = useRef<HTMLDivElement>(null);
  const visibleQuestReceipts = useMemo(
    () => state.questReceiptCues.filter((cue) => cue.appearsAt <= state.now),
    [state.questReceiptCues, state.now]
  );
  const visibleQuestIds = useMemo(() => getVisibleQuestIds(state), [state]);
  const hasUnreadQuests = useMemo(
    () => visibleQuestIds.some((questId) => !state.seenQuestIds.includes(questId)),
    [visibleQuestIds, state.seenQuestIds]
  );

  useEffect(() => {
    if (selectedObject && !selectedObject.dialogueId && (selectedObject.dialogueRoutes?.length ?? 0) === 0) {
      setActiveTab("abilities");
    }
  }, [selectedObject]);

  useEffect(() => {
    if (!state.activeDialogue && activeTab === "quests" && hasUnreadQuests) {
      dispatch({ type: "ACKNOWLEDGE_VISIBLE_QUESTS" });
    }
  }, [activeTab, dispatch, hasUnreadQuests, state.activeDialogue]);

  const totalPassivePages = Math.max(1, Math.ceil(passiveSkills.length / PASSIVES_PER_PAGE));
  const visiblePassives = passiveSkills.slice(
    passivePage * PASSIVES_PER_PAGE,
    (passivePage + 1) * PASSIVES_PER_PAGE
  );

  return (
    <div className="column column-skills">
      <div className="skills-tab-area" ref={tabAreaRef}>
        <div className="skills-tab-grid">
          {MIDDLE_TABS.map((tab) => {
            const isLocked = tab.id === "bioboard" || tab.id === "crafting";
            return (
              <button
                key={tab.id}
                type="button"
                className={`skills-tab ${activeTab === tab.id ? "is-active" : ""}${isLocked ? " is-locked" : ""}`}
                onClick={() => { if (!isLocked) setActiveTab(tab.id); }}
                disabled={isLocked}
                title={isLocked ? "Locked" : undefined}
              >
                <span className="skills-tab-label">{isLocked ? "???" : tab.label}</span>
                {tab.id === "quests" && hasUnreadQuests ? (
                  <span className="skills-tab-indicator" aria-label="New quest" title="New quest">
                    !
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {visibleQuestReceipts.length > 0 && tabAreaRef.current
        ? createPortal(
            <QuestReceiptOverlay anchorRef={tabAreaRef} cues={visibleQuestReceipts} now={state.now} />,
            document.body
          )
        : null}

      <div className={`skills-tab-panel tab-${state.activeDialogue ? "dialogue" : activeTab}`}>
        {state.activeDialogue ? <DialogueOptionsPanel /> : null}

        {!state.activeDialogue && activeTab === "abilities" ? (
          selectedObject ? (
            <InteractableAbilitiesPanel />
          ) : (
            <div className="skills-placeholder-panel">
              <p className="skills-placeholder-title">Abilities</p>
              <p className="empty-text">Select an interactable to view its abilities.</p>
            </div>
          )
        ) : null}

        {!state.activeDialogue && activeTab === "quests" ? <QuestBoard /> : null}

        {!state.activeDialogue && activeTab === "bioboard" ? <BioboardPanel /> : null}

        {!state.activeDialogue && activeTab === "passives" ? (
          <>
            {totalPassivePages > 1 ? (
              <div className="skills-tab-nav">
                <button
                  type="button"
                  className="section-nav-btn"
                  disabled={passivePage <= 0}
                  onClick={() => setPassivePage((p) => p - 1)}
                >
                  {"\u25C0"}
                </button>
                <div className="section-nav-dots" aria-hidden="true">
                  {Array.from({ length: totalPassivePages }, (_, index) => (
                    <span
                      key={index}
                      className={`section-nav-dot ${index === passivePage ? "is-active" : ""}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="section-nav-btn"
                  disabled={passivePage >= totalPassivePages - 1}
                  onClick={() => setPassivePage((p) => p + 1)}
                >
                  {"\u25B6"}
                </button>
              </div>
            ) : null}
            {visiblePassives.map((skill) => (
              <div key={skill.id} className="skill-bar-group">
                <SkillBar
                  variant="passive"
                  name={skill.name}
                  level={skill.level}
                  xp={skill.xp}
                  xpToNext={skill.xpToNext}
                  color={skill.barColor}
                  accent={skill.accentColor}
                  perkMilestones={skill.perkMilestones}
                  floatingLabels={skillFloatMap.get(skill.id)}
                  tooltip={skill.description}
                />
              </div>
            ))}
          </>
        ) : null}

        {!state.activeDialogue && activeTab === "backpack" ? <BackpackBoard /> : null}

        {!state.activeDialogue && activeTab === "crafting" ? <CraftingBoard /> : null}

        {!state.activeDialogue && activeTab in PLACEHOLDER_COPY ? (
          <div className="skills-placeholder-panel">
            <p className="skills-placeholder-title">{activeTab}</p>
            <p className="empty-text">{PLACEHOLDER_COPY[activeTab as keyof typeof PLACEHOLDER_COPY]}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
