import { PlayerHeader } from "./PlayerHeader";
import { VitalsGauges } from "./VitalsGauges";
import { EquipmentGrid } from "./EquipmentGrid";
import { FeyRunes } from "./FeyRunes";
import { MinimapPanel } from "./MinimapPanel";

export function PlayerColumn() {
  return (
    <div className="column column-player">
      <PlayerHeader />
      <VitalsGauges />
      <div className="equip-runes-row">
        <div className="equip-runes-left">
          <div className="section-header-bar">
            <p className="section-label">Equipment</p>
          </div>
          <div className="section-divider-body">
            <EquipmentGrid />
          </div>
        </div>
        <div className="equip-runes-right">
          <div className="section-header-bar">
            <p className="section-label">Fey Runes</p>
          </div>
          <div className="section-divider-body">
            <FeyRunes />
          </div>
        </div>
      </div>
      <MinimapPanel />
    </div>
  );
}
