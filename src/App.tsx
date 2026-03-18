import { useEffect, useReducer, useState } from "react";
import { loadBundle } from "./data/loader";
import { playAmbient } from "./audio";
import { comboDefsToRules } from "./data/bridge";
import { reducer, setCombos, createInitialState } from "./state";
import { GameContext } from "./GameContext";
import { ThreeColumnLayout } from "./components/layout/ThreeColumnLayout";
import { PlayerColumn } from "./components/player/PlayerColumn";
import { SkillsColumn } from "./components/skills/SkillsColumn";
import { WorldColumn } from "./components/world/WorldColumn";

// ── Game App (renders after content is loaded) ──

function GameApp() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch({ type: "TICK", now: Date.now() });
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      <div className="app-shell">
        <ThreeColumnLayout
          left={<PlayerColumn />}
          center={<SkillsColumn />}
          right={<WorldColumn />}
        />
      </div>
    </GameContext.Provider>
  );
}

// ── App wrapper (handles loading) ──

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/data/game-content.json");
        if (res.ok) {
          const data = await res.json();
          loadBundle(data);
          setCombos(comboDefsToRules(data.combos ?? []));
          const startRoom = data.world?.rooms?.find((r: { id: string }) => r.id === data.world?.startingRoomId);
          if (startRoom?.ambientSound) playAmbient(startRoom.ambientSound);
        } else {
          setError("No game-content.json found. Export one from the Content Editor.");
        }
      } catch (err) {
        console.warn("Failed to load game content:", err);
        setError("Failed to load game content. Make sure game-content.json exists in public/data/.");
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#aaa", fontFamily: "monospace" }}>Loading game content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem" }}>
        <p style={{ color: "#ff6b6b", fontFamily: "monospace", fontSize: "1.1rem" }}>{error}</p>
        <p style={{ color: "#888", fontFamily: "monospace", fontSize: "0.9rem" }}>
          Place game-content.json in public/data/ and reload.
        </p>
      </div>
    );
  }

  return <GameApp />;
}

export default App;
