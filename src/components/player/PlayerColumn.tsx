import { PlayerHeader } from "./PlayerHeader";
import { VitalsGauges } from "./VitalsGauges";
import { EquipmentGrid } from "./EquipmentGrid";
import { FeyRunes } from "./FeyRunes";
import { BackpackGrid } from "./BackpackGrid";
import { ChangelogPanel } from "./ChangelogPanel";

export function PlayerColumn() {
  return (
    <div className="column column-player">
      <PlayerHeader />
      <ChangelogPanel />
      <VitalsGauges />
      <div className="equip-runes-row">
        <div className="equip-runes-left">
          <p className="section-label">Equipment</p>
          <div className="section-divider-body">
            <EquipmentGrid />
          </div>
        </div>
        <div className="equip-runes-right">
          <p className="section-label">Fey Runes</p>
          <div className="section-divider-body">
            <FeyRunes />
          </div>
        </div>
      </div>
      <BackpackGrid />
    </div>
  );
}
