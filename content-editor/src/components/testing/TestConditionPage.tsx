import { useState, useMemo } from "react";
import { PageShell } from "../layout/PageShell";
import { useSkillStore } from "../../stores/skillStore";
import { useItemStore } from "../../stores/itemStore";
import { useStorageKeyStore } from "../../stores/storageKeyStore";
import { useWorldStore } from "../../stores/worldStore";
import { useStatusEffectStore } from "../../stores/statusEffectStore";
import { parse } from "../../dsl/parser";
import { testEvaluate, createEmptyContext } from "../../dsl/testEvaluator";
import type { MockContext } from "../../dsl/testEvaluator";

export function TestConditionPage() {
  const { skills } = useSkillStore();
  const { items } = useItemStore();
  const { storageKeys } = useStorageKeyStore();
  const { world } = useWorldStore();
  const { statusEffects } = useStatusEffectStore();

  const [condition, setCondition] = useState("");
  const [mockCtx, setMockCtx] = useState<MockContext>(createEmptyContext);

  // Parse and evaluate
  const result = useMemo(() => {
    if (!condition.trim()) return null;
    const parsed = parse(condition);
    if (parsed.errors.length > 0) {
      return { type: "parse-error" as const, message: parsed.errors[0].message };
    }
    const evalResult = testEvaluate(parsed.ast, mockCtx);
    if (evalResult.error) {
      return { type: "eval-error" as const, message: evalResult.error };
    }
    return { type: "ok" as const, value: evalResult.result };
  }, [condition, mockCtx]);

  const setSkillLevel = (id: string, level: number) => {
    setMockCtx((prev) => ({
      ...prev,
      skills: { ...prev.skills, [id]: { ...prev.skills[id], level, unlocked: level > 0 } },
    }));
  };

  const setItemCount = (id: string, count: number) => {
    setMockCtx((prev) => ({
      ...prev,
      items: { ...prev.items, [id]: count },
    }));
  };

  const setFlag = (id: string, val: boolean) => {
    setMockCtx((prev) => ({
      ...prev,
      flags: { ...prev.flags, [id]: val },
    }));
  };

  const setCounter = (id: string, val: number) => {
    setMockCtx((prev) => ({
      ...prev,
      counters: { ...prev.counters, [id]: val },
    }));
  };

  const setValue = (id: string, val: string) => {
    setMockCtx((prev) => ({
      ...prev,
      values: { ...prev.values, [id]: val },
    }));
  };

  const setEffectStacks = (id: string, stacks: number) => {
    setMockCtx((prev) => ({
      ...prev,
      effects: { ...prev.effects, [id]: stacks },
    }));
  };

  return (
    <PageShell title="Test Conditions">
      {/* Condition Input */}
      <section className="editor-section">
        <h3 className="section-title">Condition Expression</h3>
        <p className="section-desc">
          Enter a DSL condition to test. Configure mock state below to simulate game state.
        </p>
        <input
          className="form-input"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder={'e.g. skill("treecutting").level >= 3'}
          style={{ fontFamily: "monospace" }}
        />
        {result && (
          <div
            className="test-result"
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 14,
              background:
                result.type === "ok"
                  ? result.value
                    ? "var(--bg-success, #1a3a2a)"
                    : "var(--bg-error, #3a1a1a)"
                  : "var(--bg-error, #3a1a1a)",
              color:
                result.type === "ok"
                  ? result.value
                    ? "var(--text-success, #4ade80)"
                    : "var(--text-error, #f87171)"
                  : "var(--text-error, #f87171)",
            }}
          >
            {result.type === "ok"
              ? result.value
                ? "TRUE"
                : "FALSE"
              : `Error: ${result.message}`}
          </div>
        )}
      </section>

      {/* Mock Skills */}
      {skills.length > 0 && (
        <section className="editor-section">
          <h3 className="section-title">Skill Levels</h3>
          <div className="mock-state-grid">
            {skills.map((sk) => (
              <div key={sk.id} className="mock-state-row">
                <label className="mock-state-label">{sk.name || sk.id}</label>
                <input
                  type="number"
                  className="form-input form-input--sm"
                  min={0}
                  value={mockCtx.skills[sk.id]?.level ?? 0}
                  onChange={(e) => setSkillLevel(sk.id, Number(e.target.value))}
                  style={{ width: 64 }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mock Items */}
      {items.length > 0 && (
        <section className="editor-section">
          <h3 className="section-title">Item Counts</h3>
          <div className="mock-state-grid">
            {items.map((it) => (
              <div key={it.id} className="mock-state-row">
                <label className="mock-state-label">{it.name || it.id}</label>
                <input
                  type="number"
                  className="form-input form-input--sm"
                  min={0}
                  value={mockCtx.items[it.id] ?? 0}
                  onChange={(e) => setItemCount(it.id, Number(e.target.value))}
                  style={{ width: 64 }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mock Storage Keys */}
      {storageKeys.length > 0 && (
        <section className="editor-section">
          <h3 className="section-title">Storage Keys</h3>
          <div className="mock-state-grid">
            {storageKeys.map((sk) => (
              <div key={sk.id} className="mock-state-row">
                <label className="mock-state-label">{sk.label || sk.id}</label>
                {sk.type === "flag" ? (
                  <input
                    type="checkbox"
                    checked={mockCtx.flags[sk.id] ?? false}
                    onChange={(e) => setFlag(sk.id, e.target.checked)}
                  />
                ) : sk.type === "counter" ? (
                  <input
                    type="number"
                    className="form-input form-input--sm"
                    value={mockCtx.counters[sk.id] ?? 0}
                    onChange={(e) => setCounter(sk.id, Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                ) : (
                  <input
                    className="form-input form-input--sm"
                    value={String(mockCtx.values[sk.id] ?? "")}
                    onChange={(e) => setValue(sk.id, e.target.value)}
                    style={{ width: 120 }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mock Active Effects */}
      {statusEffects.length > 0 && (
        <section className="editor-section">
          <h3 className="section-title">Active Effects</h3>
          <p className="section-desc">
            Set stack count per effect. 0 = not active (has_effect returns false).
          </p>
          <div className="mock-state-grid">
            {statusEffects.map((fx) => (
              <div key={fx.id} className="mock-state-row">
                <label className="mock-state-label">
                  <span
                    className="fx-dot"
                    style={{ backgroundColor: fx.color }}
                  />
                  {fx.name || fx.id}
                </label>
                <input
                  type="number"
                  className="form-input form-input--sm"
                  min={0}
                  value={mockCtx.effects[fx.id] ?? 0}
                  onChange={(e) => setEffectStacks(fx.id, Number(e.target.value))}
                  style={{ width: 64 }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mock Room/Target */}
      <section className="editor-section">
        <h3 className="section-title">Room & Target</h3>
        <div className="mock-state-grid">
          <div className="mock-state-row">
            <label className="mock-state-label">Room ID</label>
            <select
              className="form-input form-input--sm"
              value={mockCtx.roomId}
              onChange={(e) => setMockCtx((p) => ({ ...p, roomId: e.target.value }))}
              style={{ width: 160 }}
            >
              <option value="">(none)</option>
              {world.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || r.id}
                </option>
              ))}
            </select>
          </div>
          <div className="mock-state-row">
            <label className="mock-state-label">Explore Count</label>
            <input
              type="number"
              className="form-input form-input--sm"
              min={0}
              value={mockCtx.exploreCount}
              onChange={(e) =>
                setMockCtx((p) => ({ ...p, exploreCount: Number(e.target.value) }))
              }
              style={{ width: 64 }}
            />
          </div>
          <div className="mock-state-row">
            <label className="mock-state-label">Target Tag</label>
            <input
              className="form-input form-input--sm"
              value={mockCtx.targetTag}
              onChange={(e) => setMockCtx((p) => ({ ...p, targetTag: e.target.value }))}
              style={{ width: 120 }}
            />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
