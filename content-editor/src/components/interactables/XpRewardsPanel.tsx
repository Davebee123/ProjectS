import { useSkillStore } from "../../stores/skillStore";
import type { XpReward } from "../../schema/types";

interface Props {
  rewards: XpReward[];
  onChange: (rewards: XpReward[]) => void;
}

export function XpRewardsPanel({ rewards, onChange }: Props) {
  const { skills } = useSkillStore();

  const add = () => {
    onChange([...rewards, { skillId: "", amount: 10 }]);
  };

  const update = (idx: number, patch: Partial<XpReward>) => {
    const updated = [...rewards];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const remove = (idx: number) => onChange(rewards.filter((_, i) => i !== idx));

  return (
    <section className="editor-section">
      <h3 className="section-title">XP Rewards</h3>
      <p className="section-desc">
        XP granted to skills when this interactable is destroyed.
      </p>
      <table className="editor-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rewards.map((r, idx) => (
            <tr key={idx}>
              <td>
                <select
                  className="input select"
                  value={r.skillId}
                  onChange={(e) => update(idx, { skillId: e.target.value })}
                >
                  <option value="">-- Select skill --</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  className="input input--sm"
                  value={r.amount}
                  onChange={(e) =>
                    update(idx, { amount: Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => remove(idx)}
                >
                  X
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn--sm" onClick={add}>
        + Add XP Reward
      </button>
    </section>
  );
}
