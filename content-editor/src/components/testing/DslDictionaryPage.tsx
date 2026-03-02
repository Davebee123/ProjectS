import { PageShell } from "../layout/PageShell";

export function DslDictionaryPage() {
  return (
    <PageShell title="DSL Reference">
      {/* ── Functions ── */}
      <section className="editor-section">
        <h3 className="section-title">Functions</h3>
        <p className="section-desc">
          Built-in functions available in condition expressions and hooks.
        </p>
        <table className="editor-table">
          <thead>
            <tr>
              <th>Expression</th>
              <th>Returns</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>skill("id")</code></td>
              <td><code>SkillRef</code></td>
              <td>Access a skill by ID. Chain with properties below.</td>
            </tr>
            <tr>
              <td><code>player.has_item("id")</code></td>
              <td><code>boolean</code></td>
              <td>True if the player holds at least one of the specified item.</td>
            </tr>
            <tr>
              <td><code>player.item_count("id")</code></td>
              <td><code>number</code></td>
              <td>Count of the specified item currently in the player's inventory.</td>
            </tr>
            <tr>
              <td><code>player.flag("keyId")</code></td>
              <td><code>boolean</code></td>
              <td>Read a boolean storage flag by its key ID.</td>
            </tr>
            <tr>
              <td><code>player.counter("keyId")</code></td>
              <td><code>number</code></td>
              <td>Read a numeric storage counter by its key ID.</td>
            </tr>
            <tr>
              <td><code>player.value("keyId")</code></td>
              <td><code>string | number</code></td>
              <td>Read an arbitrary storage value by its key ID.</td>
            </tr>
            <tr>
              <td><code>player.has_effect("id")</code></td>
              <td><code>boolean</code></td>
              <td>True if the specified status effect is currently active on the player.</td>
            </tr>
            <tr>
              <td><code>player.effect_stacks("id")</code></td>
              <td><code>number</code></td>
              <td>Stack count of the specified status effect (0 if not active).</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Properties ── */}
      <section className="editor-section">
        <h3 className="section-title">Properties</h3>
        <p className="section-desc">
          Properties that can be read off of objects and the game world.
        </p>
        <table className="editor-table">
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>skill("id").level</code></td>
              <td><code>number</code></td>
              <td>Current level of the skill.</td>
            </tr>
            <tr>
              <td><code>skill("id").unlocked</code></td>
              <td><code>boolean</code></td>
              <td>Whether the skill has been unlocked by the player.</td>
            </tr>
            <tr>
              <td><code>room.id</code></td>
              <td><code>string</code></td>
              <td>ID of the room the player is currently in.</td>
            </tr>
            <tr>
              <td><code>room.explore_count</code></td>
              <td><code>number</code></td>
              <td>Number of times the current room has been explored.</td>
            </tr>
            <tr>
              <td><code>target.tag</code></td>
              <td><code>string</code></td>
              <td>Activity tag of the current interactable target (hooks only).</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Operators ── */}
      <section className="editor-section">
        <h3 className="section-title">Operators</h3>
        <div className="form-grid">
          <div>
            <h4 style={{ marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
              Comparison
            </h4>
            <table className="editor-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>==</code></td><td>Equal to</td></tr>
                <tr><td><code>!=</code></td><td>Not equal to</td></tr>
                <tr><td><code>&gt;=</code></td><td>Greater than or equal</td></tr>
                <tr><td><code>&lt;=</code></td><td>Less than or equal</td></tr>
                <tr><td><code>&gt;</code></td><td>Greater than</td></tr>
                <tr><td><code>&lt;</code></td><td>Less than</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 style={{ marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
              Logical
            </h4>
            <table className="editor-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>AND</code></td><td>Both conditions must be true</td></tr>
                <tr><td><code>OR</code></td><td>Either condition must be true</td></tr>
                <tr><td><code>NOT</code></td><td>Inverts the following condition</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Full Example ── */}
      <section className="editor-section">
        <h3 className="section-title">Full Example</h3>
        <p className="section-desc">
          Conditions can be combined across multiple lines using AND / OR / NOT.
          Indentation is optional but helps readability.
        </p>
        <pre className="json-preview">{`skill("treecutting").level >= 5
  AND player.has_item("rusty_hatchet")
  AND NOT player.flag("boss_defeated")`}</pre>
        <p className="section-desc" style={{ marginTop: 12 }}>
          Plain language: "The player's Treecutting skill is level 5 or higher,
          they have a Rusty Hatchet in their inventory, and they have NOT yet
          defeated the boss."
        </p>

        <p className="section-desc" style={{ marginTop: 16 }}>
          Another example using OR and a counter check:
        </p>
        <pre className="json-preview">{`player.counter("ore_mined") >= 100
  OR (skill("mining").level >= 10 AND player.flag("veteran_miner"))`}</pre>
        <p className="section-desc" style={{ marginTop: 12 }}>
          Plain language: "The player has mined 100 or more ores total, OR they
          are at least Mining level 10 and have earned the Veteran Miner flag."
        </p>
      </section>

      {/* ── Usage Notes ── */}
      <section className="editor-section">
        <h3 className="section-title">Usage Notes</h3>
        <ul className="section-desc" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>String arguments may use <code>double quotes</code> or <code>single quotes</code> — both are supported.</li>
          <li>IDs passed to functions must exactly match the ID field of the entity (case-sensitive).</li>
          <li><code>AND</code> / <code>OR</code> / <code>NOT</code> are uppercase keywords.</li>
          <li>Parentheses can be used to group sub-expressions and control precedence.</li>
          <li>Leaving a condition field blank means "always true" — the entity is unconditionally active.</li>
          <li>Use the <strong>Test Conditions</strong> page to validate expressions against mock player state.</li>
        </ul>
      </section>
    </PageShell>
  );
}
