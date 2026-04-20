import { useMemo } from "react";
import { useGame } from "../../GameContext";
import { getWeatherDef } from "../../data/loader";

export function PlayerHeader() {
  const { state } = useGame();
  const weatherDef = useMemo(() => getWeatherDef(state.weather), [state.weather]);
  const weatherLabel = weatherDef?.name ?? state.weather.charAt(0).toUpperCase() + state.weather.slice(1);
  const weatherIcon = weatherDef?.icon ?? "?";
  return (
    <div className="player-header">
      <div className="player-header-strip">
        <div className="player-header-segment player-header-segment-main">
          <span className="player-header-card-label">Adventurer</span>
          <div className="player-header-main-row">
            <span className="player-header-name">{state.playerName}</span>
          </div>
        </div>
        <div className="player-header-divider" aria-hidden="true" />
        <div className="player-header-segment player-header-segment-weather" title={state.weather}>
          <span className="player-header-card-label">Weather</span>
          <div className="player-header-weather-row">
            <span className="player-header-card-icon">{weatherIcon}</span>
            <span className="player-header-card-value player-header-card-value-weather">
              {weatherLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
