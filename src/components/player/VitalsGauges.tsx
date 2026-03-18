import { useGame } from "../../GameContext";
import { CircularGauge } from "../shared/CircularGauge";

export function VitalsGauges() {
  const { state } = useGame();
  return (
    <div className="vitals-section">
      <p className="section-label">Vitals</p>
      <div className="vitals-row">
        <CircularGauge
          value={state.health}
          max={state.maxHealth}
          color="var(--health-color, #e05050)"
          label="Health"
        />
        <CircularGauge
          value={state.mana}
          max={state.maxMana}
          color="var(--mana-color, #5090e0)"
          label="Mana"
        />
        <CircularGauge
          value={state.energy}
          max={state.maxEnergy}
          color="var(--energy-color, #e0a030)"
          label="Energy"
        />
      </div>
    </div>
  );
}
