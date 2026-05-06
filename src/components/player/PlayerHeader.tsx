import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../../GameContext";
import { getWeatherDef } from "../../data/loader";

function formatSaveTime(savedAt: number): string {
  return new Date(savedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PlayerHeader() {
  const {
    state,
    canManualSave,
    latestSaveSummary,
    saveSummaries,
    onCreateManualSave,
    onDeleteManualSave,
    onLoadSave,
  } = useGame();
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [mode, setMode] = useState<"save" | "load">("save");

  const weatherDef = useMemo(() => getWeatherDef(state.weather), [state.weather]);
  const weatherLabel = weatherDef?.name ?? state.weather.charAt(0).toUpperCase() + state.weather.slice(1);
  const weatherIcon = weatherDef?.icon ?? "?";
  const saveSummaryText = latestSaveSummary
    ? `${latestSaveSummary.slot === "autosave" ? "Autosave" : latestSaveSummary.name} · ${latestSaveSummary.roomName} · Lv ${latestSaveSummary.playerLevel}`
    : "No save yet";

  const openSaveManager = (nextMode: "save" | "load") => {
    setMode(nextMode);
    setSaveName(
      nextMode === "save"
        ? `${state.playerName} - ${state.currentRoomId}`
        : ""
    );
    setIsSaveManagerOpen(true);
  };

  const closeSaveManager = () => {
    setIsSaveManagerOpen(false);
    setSaveName("");
  };

  const createSave = () => {
    if (!canManualSave) {
      return;
    }
    onCreateManualSave(saveName);
    closeSaveManager();
  };

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
      <div className="player-header-savebar">
        <span className="player-header-save-summary">{saveSummaryText}</span>
        <div className="player-header-save-actions">
          <button
            type="button"
            className="player-header-save-button"
            onClick={() => openSaveManager("save")}
            disabled={!canManualSave}
          >
            Save
          </button>
          <button
            type="button"
            className="player-header-save-button"
            onClick={() => openSaveManager("load")}
            disabled={saveSummaries.length === 0}
          >
            Load
          </button>
        </div>
      </div>

      {isSaveManagerOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="save-manager-overlay" onClick={closeSaveManager}>
              <div className="save-manager-panel" onClick={(event) => event.stopPropagation()}>
                <div className="save-manager-header">
                  <div>
                    <p className="save-manager-title">{mode === "save" ? "Create Save" : "Load Save"}</p>
                    <p className="save-manager-subtitle">
                      {mode === "save"
                        ? "Manual saves are only available while you are idle."
                        : "Choose a save file to restore."}
                    </p>
                  </div>
                  <button type="button" className="save-manager-close" onClick={closeSaveManager}>
                    Close
                  </button>
                </div>

                {mode === "save" ? (
                  <div className="save-manager-create-row">
                    <input
                      className="save-manager-input"
                      value={saveName}
                      onChange={(event) => setSaveName(event.target.value)}
                      placeholder="Save name"
                    />
                    <button
                      type="button"
                      className="save-manager-primary"
                      onClick={createSave}
                      disabled={!canManualSave}
                    >
                      Save Now
                    </button>
                  </div>
                ) : null}

                <div className="save-manager-list">
                  {saveSummaries.length > 0 ? (
                    saveSummaries.map((save) => (
                      <div key={save.id} className="save-manager-entry">
                        <div className="save-manager-entry-main">
                          <p className="save-manager-entry-name">{save.name}</p>
                          <p className="save-manager-entry-meta">
                            {save.slot === "autosave" ? "Autosave" : "Manual"} · {save.roomName} · Lv {save.playerLevel} · {formatSaveTime(save.savedAt)}
                          </p>
                        </div>
                        <div className="save-manager-entry-actions">
                          <button
                            type="button"
                            className="save-manager-entry-button"
                            onClick={() => {
                              onLoadSave(save.id);
                              closeSaveManager();
                            }}
                          >
                            Load
                          </button>
                          {save.slot === "manual" ? (
                            <button
                              type="button"
                              className="save-manager-entry-button is-danger"
                              onClick={() => onDeleteManualSave(save.id)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="save-manager-empty">No save files available.</p>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
