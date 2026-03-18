import { useGame } from "../../GameContext";
import type { WeatherType } from "../../state";

const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: "\u2600",    // ☀
  cloudy: "\u2601",   // ☁
  rainy: "\uD83C\uDF27\uFE0F",  // 🌧️
  stormy: "\u26C8",   // ⛈
};

export function PlayerHeader() {
  const { state } = useGame();
  return (
    <div className="player-header">
      <div className="player-header-grid">
        <div className="player-header-card player-header-card-main">
          <span className="player-header-name">{state.playerName}</span>
          <span className="player-header-level">{state.playerLevel}</span>
        </div>
        <div className="player-header-card">
          <span className="player-header-card-label">Temporal Seed</span>
          <span className="player-header-card-value">{state.seed}</span>
        </div>
        <div className="player-header-card player-header-card-weather" title={state.weather}>
          <span className="player-header-card-icon">{WEATHER_ICONS[state.weather]}</span>
          <span className="player-header-card-value player-header-card-value-weather">
            {state.weather.charAt(0).toUpperCase() + state.weather.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
