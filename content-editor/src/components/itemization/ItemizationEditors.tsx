import type {
  ItemRequirements,
  ModifierOperation,
  ModifierPayload,
  ModifierScope,
  ModifierStatDef,
} from "../../schema/types";

const SYSTEM_OPTIONS = ["", "gathering", "combat"] as const;
const COMBAT_SCHOOLS = ["", "string", "entropy", "genesis", "chaos"] as const;

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatCsv(values?: string[]): string {
  return (values ?? []).join(", ");
}

function normalizeScope(scope: ModifierScope | undefined): ModifierScope | undefined {
  if (!scope) return undefined;
  const next: ModifierScope = {};
  if (scope.system) next.system = scope.system;
  if (scope.combatSchool) next.combatSchool = scope.combatSchool;
  if (scope.abilityTagIds?.length) next.abilityTagIds = scope.abilityTagIds;
  if (scope.skillIds?.length) next.skillIds = scope.skillIds;
  if (scope.targetTag) next.targetTag = scope.targetTag;
  return Object.keys(next).length > 0 ? next : undefined;
}

interface ModifierPayloadListEditorProps {
  title?: string;
  description?: string;
  modifiers: ModifierPayload[];
  modifierStats: ModifierStatDef[];
  onChange: (modifiers: ModifierPayload[]) => void;
  activityTags?: Array<{ id: string; label: string }>;
}

export function ModifierPayloadListEditor({
  title = "Modifiers",
  description,
  modifiers,
  modifierStats,
  onChange,
  activityTags,
}: ModifierPayloadListEditorProps) {
  const addModifier = () => {
    const defaultStat = modifierStats[0];
    if (!defaultStat) return;
    onChange([
      ...modifiers,
      {
        statId: defaultStat.id,
        operation: defaultStat.supportedOperations[0] ?? ("add" as ModifierOperation),
        value: 0,
      },
    ]);
  };

  const updateModifier = (index: number, patch: Partial<ModifierPayload>) => {
    onChange(modifiers.map((modifier, modifierIndex) => (modifierIndex === index ? { ...modifier, ...patch } : modifier)));
  };

  const updateScope = (index: number, patch: Partial<ModifierScope>) => {
    const current = modifiers[index]?.scope;
    updateModifier(index, { scope: normalizeScope({ ...(current ?? {}), ...patch }) });
  };

  const removeModifier = (index: number) => {
    onChange(modifiers.filter((_, modifierIndex) => modifierIndex !== index));
  };

  return (
    <section className="editor-section">
      <div className="editor-subsection-header">
        <div>
          <h3 className="section-title" style={{ marginBottom: 0 }}>{title}</h3>
          {description ? <p className="section-desc">{description}</p> : null}
        </div>
        <button className="btn btn--sm" type="button" onClick={addModifier} disabled={modifierStats.length === 0}>
          + Add Modifier
        </button>
      </div>
      {modifiers.length === 0 ? (
        <p className="section-desc">No modifiers configured.</p>
      ) : (
        modifiers.map((modifier, index) => {
          const statDef = modifierStats.find((entry) => entry.id === modifier.statId) ?? modifierStats[0];
          const supportedOperations = statDef?.supportedOperations ?? ["add", "multiply"];
          const supportsScope = statDef?.supportsScope ?? false;
          return (
            <div key={`${modifier.statId}_${index}`} className="editor-subsection">
              <div className="editor-subsection-header">
                <h4 className="section-title" style={{ marginBottom: 0 }}>
                  Modifier {index + 1}
                </h4>
                <button className="btn btn--danger btn--sm" type="button" onClick={() => removeModifier(index)}>
                  Remove
                </button>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="field-label">Stat</label>
                  <select
                    className="input select"
                    value={modifier.statId}
                    onChange={(e) => {
                      const nextStat = modifierStats.find((entry) => entry.id === e.target.value);
                      updateModifier(index, {
                        statId: e.target.value,
                        operation: nextStat?.supportedOperations[0] ?? modifier.operation,
                        scope: nextStat?.supportsScope ? modifier.scope : undefined,
                      });
                    }}
                  >
                    {modifierStats.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label">Operation</label>
                  <select
                    className="input select"
                    value={modifier.operation}
                    onChange={(e) => updateModifier(index, { operation: e.target.value as ModifierOperation })}
                  >
                    {supportedOperations.map((operation) => (
                      <option key={operation} value={operation}>
                        {operation}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label">Value</label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    value={modifier.value}
                    onChange={(e) => updateModifier(index, { value: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              {supportsScope ? (
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <div className="form-field">
                    <label className="field-label">System Scope</label>
                    <select
                      className="input select"
                      value={modifier.scope?.system ?? ""}
                      onChange={(e) => updateScope(index, { system: (e.target.value || undefined) as ModifierScope["system"] })}
                    >
                      {SYSTEM_OPTIONS.map((value) => (
                        <option key={value || "all"} value={value}>
                          {value ? value : "All Systems"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="field-label">Combat School</label>
                    <select
                      className="input select"
                      value={modifier.scope?.combatSchool ?? ""}
                      onChange={(e) =>
                        updateScope(index, {
                          combatSchool: (e.target.value || undefined) as ModifierScope["combatSchool"],
                        })
                      }
                    >
                      {COMBAT_SCHOOLS.map((value) => (
                        <option key={value || "all"} value={value}>
                          {value ? value : "All Schools"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="field-label">Ability Tags (CSV)</label>
                    <input
                      className="input"
                      value={formatCsv(modifier.scope?.abilityTagIds)}
                      onChange={(e) => updateScope(index, { abilityTagIds: parseCsv(e.target.value) })}
                      placeholder="gravity_manipulation, projectile"
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Skill IDs (CSV)</label>
                    <input
                      className="input"
                      value={formatCsv(modifier.scope?.skillIds)}
                      onChange={(e) => updateScope(index, { skillIds: parseCsv(e.target.value) })}
                      placeholder="telekinetic_slam, suspend"
                    />
                  </div>
                  {activityTags && activityTags.length > 0 ? (
                    <div className="form-field">
                      <label className="field-label">Target Tag</label>
                      <select
                        className="input select"
                        value={modifier.scope?.targetTag ?? ""}
                        onChange={(e) =>
                          updateScope(index, { targetTag: e.target.value || undefined })
                        }
                      >
                        <option value="">All Targets</option>
                        {activityTags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}

interface ItemRequirementsEditorProps {
  requirements: ItemRequirements | undefined;
  skillIds: string[];
  onChange: (requirements: ItemRequirements | undefined) => void;
}

export function ItemRequirementsEditor({
  requirements,
  skillIds,
  onChange,
}: ItemRequirementsEditorProps) {
  const value: ItemRequirements = requirements ?? {};
  const skills = value.skills ?? [];

  const updateSkills = (nextSkills: NonNullable<ItemRequirements["skills"]>) => {
    const nextRequirements: ItemRequirements = {
      ...value,
      skills: nextSkills.filter((entry) => entry.skillId),
    };
    if (!nextRequirements.playerLevel && !(nextRequirements.skills?.length)) {
      onChange(undefined);
      return;
    }
    onChange(nextRequirements);
  };

  return (
    <section className="editor-section">
      <h3 className="section-title">Requirements</h3>
      <div className="form-grid">
        <div className="form-field">
          <label className="field-label">Player Level</label>
          <input
            type="number"
            min={1}
            className="input"
            value={value.playerLevel ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                playerLevel: e.target.value ? Math.max(1, Number(e.target.value) || 1) : undefined,
              })
            }
            placeholder="No level requirement"
          />
        </div>
      </div>
      <div className="editor-subsection">
        <div className="editor-subsection-header">
          <h4 className="section-title" style={{ marginBottom: 0 }}>Skill Requirements</h4>
          <button
            className="btn btn--sm"
            type="button"
            onClick={() =>
              updateSkills([
                ...skills,
                {
                  skillId: skillIds[0] ?? "",
                  level: 1,
                },
              ])
            }
          >
            + Add Skill Requirement
          </button>
        </div>
        {skills.length === 0 ? (
          <p className="section-desc">No skill requirements configured.</p>
        ) : (
          skills.map((entry, index) => (
            <div key={`${entry.skillId}_${index}`} className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-field">
                <label className="field-label">Skill</label>
                <select
                  className="input select"
                  value={entry.skillId}
                  onChange={(e) =>
                    updateSkills(skills.map((skillEntry, skillIndex) => (
                      skillIndex === index ? { ...skillEntry, skillId: e.target.value } : skillEntry
                    )))
                  }
                >
                  <option value="">(select skill)</option>
                  {skillIds.map((skillId) => (
                    <option key={skillId} value={skillId}>
                      {skillId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="field-label">Required Level</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={entry.level}
                  onChange={(e) =>
                    updateSkills(skills.map((skillEntry, skillIndex) => (
                      skillIndex === index
                        ? { ...skillEntry, level: Math.max(1, Number(e.target.value) || 1) }
                        : skillEntry
                    )))
                  }
                />
              </div>
              <div className="form-field" style={{ alignSelf: "end" }}>
                <button
                  className="btn btn--danger btn--sm"
                  type="button"
                  onClick={() => updateSkills(skills.filter((_, skillIndex) => skillIndex !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

interface CsvFieldProps {
  label: string;
  value: string[] | undefined;
  placeholder?: string;
  onChange: (values: string[]) => void;
}

export function CsvField({ label, value, placeholder, onChange }: CsvFieldProps) {
  return (
    <div className="form-field">
      <label className="field-label">{label}</label>
      <input
        className="input"
        value={formatCsv(value)}
        onChange={(e) => onChange(parseCsv(e.target.value))}
        placeholder={placeholder}
      />
    </div>
  );
}
