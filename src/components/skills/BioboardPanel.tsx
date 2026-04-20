import { useMemo, useState } from "react";
import { useGame } from "../../GameContext";

const COMBAT_SCHOOLS = [
  { id: "general", label: "General" },
  { id: "string", label: "String Combat" },
  { id: "entropy", label: "Entropy Combat" },
  { id: "genesis", label: "Genesis Combat" },
  { id: "chaos", label: "Chaos Combat" },
] as const;

export function BioboardPanel() {
  const { state, dispatch } = useGame();
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: false,
    string: false,
    entropy: false,
    genesis: false,
    chaos: false,
  });

  const combatSkills = useMemo(
    () =>
      state.skills.filter(
        (skill) =>
          skill.kind === "active" &&
          skill.unlocked &&
          skill.system === "combat"
      ),
    [state.skills]
  );

  const filteredCombatSkills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return combatSkills.filter((skill) => {
      if (!query) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(query) ||
        (skill.bioboardSubcategory || "").toLowerCase().includes(query) ||
        (skill.bioboardPrimaryText || "").toLowerCase().includes(query) ||
        (skill.bioboardSecondaryText || "").toLowerCase().includes(query)
      );
    });
  }, [combatSkills, search]);

  const groupedCombatSkills = useMemo(() => {
    const map = new Map<string, typeof combatSkills>();
    for (const school of COMBAT_SCHOOLS) {
      map.set(school.id, []);
    }
    for (const skill of filteredCombatSkills) {
      const school = skill.combatSchool || "general";
      if (!map.has(school)) map.set(school, []);
      map.get(school)!.push(skill);
    }
    return map;
  }, [filteredCombatSkills, combatSkills]);

  const slottedSkills = state.bioboardSlots.map((slotId) =>
    slotId ? state.skills.find((skill) => skill.id === slotId) ?? null : null
  );

  const hasOpenSlot = state.bioboardSlots.includes(null);

  return (
    <div className="bioboard-panel">
      <div className="bioboard-slot-grid">
        {slottedSkills.map((skill, index) => (
          <div key={`slot_${index}`} className={`bioboard-slot-card ${skill ? "is-filled" : ""}`}>
            {skill ? (
              <>
                <div className="bioboard-slot-name">{skill.name}</div>
                <button
                  type="button"
                  className="bioboard-slot-remove"
                  onClick={() => dispatch({ type: "REMOVE_BIOBOARD_SKILL", slotIndex: index })}
                  aria-label={`Remove ${skill.name} from slot ${index + 1}`}
                >
                  -
                </button>
              </>
            ) : (
              <div className="bioboard-slot-placeholder">Ability Slot {index + 1}</div>
            )}
          </div>
        ))}
      </div>

      <input
        className="bioboard-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search"
      />

      <div className="bioboard-catalog">
        {COMBAT_SCHOOLS.map((school) => {
          const skills = groupedCombatSkills.get(school.id) ?? [];
          const isOpen = openSections[school.id];
          return (
            <section key={school.id} className="bioboard-section">
              <button
                type="button"
                className="quest-category-header bioboard-category-header"
                onClick={() => setOpenSections((prev) => ({ ...prev, [school.id]: !prev[school.id] }))}
              >
                <span>{school.label}</span>
                <span className="quest-category-chevron">{isOpen ? "\u25BC" : "\u25B6"}</span>
              </button>

              {isOpen ? (
                <div className="bioboard-category-body">
                  {skills.length > 0 ? skills.map((skill) => {
                    const isSlotted = state.bioboardSlots.includes(skill.id);
                    const detailBits: Array<{ label: string; tone?: "mana" | "energy" }> = [
                      { label: `${(skill.baseDurationMs / 1000).toFixed(0)}s Cast` },
                    ];
                    if (skill.baseManaCost && skill.baseManaCost > 0) {
                      detailBits.push({ label: `Mana ${skill.baseManaCost}`, tone: "mana" });
                    }
                    detailBits.push({ label: `Energy ${skill.baseEnergyCost}`, tone: "energy" });

                    return (
                      <article key={skill.id} className="bioboard-ability-card">
                        <div className="bioboard-ability-main">
                          <div className="bioboard-ability-top">
                            <div className="bioboard-ability-image">
                              {skill.image ? <img src={skill.image} alt={skill.name} /> : <span>Image</span>}
                            </div>
                            <div className="bioboard-ability-heading">
                              <div className="bioboard-ability-name">{skill.name}</div>
                              <div className="bioboard-ability-metrics">
                                {detailBits.map((bit) => (
                                  <span
                                    key={`${skill.id}_${bit.label}`}
                                    className={bit.tone ? `is-${bit.tone}` : undefined}
                                  >
                                    {bit.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="bioboard-ability-body">
                            <div className="bioboard-ability-subcategory">{skill.bioboardSubcategory || "Combat Ability"}</div>
                            <div className="bioboard-ability-primary">{skill.bioboardPrimaryText || skill.description}</div>
                            {skill.bioboardSecondaryText ? (
                              <div className="bioboard-ability-secondary">{skill.bioboardSecondaryText}</div>
                            ) : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="bioboard-ability-add"
                          disabled={isSlotted || !hasOpenSlot}
                          onClick={() => dispatch({ type: "ASSIGN_BIOBOARD_SKILL", skillId: skill.id })}
                          aria-label={isSlotted ? `${skill.name} already slotted` : `Add ${skill.name} to bioboard`}
                        >
                          +
                        </button>
                      </article>
                    );
                  }) : (
                    <p className="empty-text">No abilities in this school.</p>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
