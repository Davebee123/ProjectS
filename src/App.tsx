import { useEffect, useReducer, useRef, useState } from "react";
import { getBundle, loadBundle } from "./data/loader";
import { playAmbient, playMusic, playManaged, stopManaged, playWeatherAmbient, stopWeatherAmbient, playSound } from "./audio";
import { getWeatherDef } from "./data/loader";
import { comboDefsToRules } from "./data/bridge";
import type { ChangelogData } from "./data/changelog";
import { reducer, setCombos, createInitialState } from "./state";
import { GameContext } from "./GameContext";
import { ThreeColumnLayout } from "./components/layout/ThreeColumnLayout";
import { PlayerColumn } from "./components/player/PlayerColumn";
import { SkillsColumn } from "./components/skills/SkillsColumn";
import { WorldColumn } from "./components/world/WorldColumn";
import { CutsceneOverlay } from "./components/cutscenes/CutsceneOverlay";
import { QuestProgressToasts } from "./components/quests/QuestProgressToasts";

// ── Game App (renders after content is loaded) ──

function GameApp({ changelog }: { changelog: ChangelogData | null }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const didStartIntroCutscene = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch({ type: "TICK", now: Date.now() });
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  // Global UI sounds: hover + click on buttons.
  // Uses MutationObserver to attach mouseenter/mouseleave directly on
  // each <button>, since those events don't fire for child elements.
  useEffect(() => {
    const managed = new WeakSet<Element>();
    let lastClickTime = 0;

    function attachButton(btn: HTMLButtonElement) {
      if (managed.has(btn)) return;
      managed.add(btn);
      btn.addEventListener("mouseenter", () => {
        if (!btn.disabled) playSound("/Sound Files/UI/ButtonHover.wav", 0.08);
      });
    }

    // Seed existing buttons
    document.querySelectorAll<HTMLButtonElement>("button").forEach(attachButton);

    // Watch for new buttons added to the DOM
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === "BUTTON") attachButton(node as HTMLButtonElement);
          node.querySelectorAll<HTMLButtonElement>("button").forEach(attachButton);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Single click handler with debounce
    const onClick = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastClickTime < 80) return;
      const btn = (e.target as HTMLElement).closest?.("button");
      if (btn && !btn.disabled) {
        lastClickTime = now;
        playSound("/Sound Files/UI/Clicksound 2.wav", 0.12);
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
    };
  }, []);

  // Manage cast sound: play when action starts (or on complete if flagged), stop when it ends
  const prevActionStartRef = useRef<number | null>(null);
  const prevActionRef = useRef<{ skillId: string; endsAt: number } | null>(null);
  useEffect(() => {
    const startedAt = state.action?.startedAt ?? null;
    const bundle = getBundle();
    if (startedAt && startedAt !== prevActionStartRef.current) {
      const skillDef = bundle?.skills.find((s) => s.id === state.action!.skillId);
      if (skillDef?.castSound && !skillDef.castSoundOnComplete) {
        playManaged("cast", skillDef.castSound, skillDef.castSoundVolume ?? 1);
      }
      prevActionRef.current = {
        skillId: state.action!.skillId,
        endsAt: state.action!.endsAt,
      };
    } else if (!startedAt && prevActionStartRef.current) {
      stopManaged("cast");
      // If action ended naturally, play castSound for skills flagged castSoundOnComplete
      const prev = prevActionRef.current;
      if (prev) {
        const skillDef = bundle?.skills.find((s) => s.id === prev.skillId);
        if (skillDef?.castSound && skillDef.castSoundOnComplete && Date.now() >= prev.endsAt - 150) {
          playSound(skillDef.castSound, skillDef.castSoundVolume ?? 1);
        }
      }
      prevActionRef.current = null;
    }
    prevActionStartRef.current = startedAt;
  }, [state.action?.startedAt]);

  // Manage weather ambient sound: play/swap when weather changes
  useEffect(() => {
    const weatherDef = getWeatherDef(state.weather);
    if (weatherDef?.ambientSound) {
      playWeatherAmbient(
        weatherDef.ambientSound,
        weatherDef.ambientSoundVolume ?? 0.3,
        weatherDef.ambientSoundLoop !== false
      );
    } else {
      stopWeatherAmbient();
    }
  }, [state.weather]);

  useEffect(() => {
    if (didStartIntroCutscene.current) {
      return;
    }
    const startingCutsceneId = getBundle()?.world.startingCutsceneId;
    if (!startingCutsceneId) {
      return;
    }
    didStartIntroCutscene.current = true;
    dispatch({ type: "START_CUTSCENE", cutsceneId: startingCutsceneId });
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch, changelog }}>
      <div className="app-shell">
        <ThreeColumnLayout
          left={<PlayerColumn />}
          center={<SkillsColumn />}
          right={<WorldColumn />}
        />
        <div className="screen-noise-overlay" aria-hidden="true" />
        <QuestProgressToasts />
        <CutsceneOverlay />
      </div>
    </GameContext.Provider>
  );
}

// ── App wrapper (handles loading) ──

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [bundleRes, changelogRes] = await Promise.all([
          fetch("/data/game-content.json"),
          fetch("/data/changelog.json").catch(() => null),
        ]);
        const res = bundleRes;
        if (res.ok) {
          const data = await res.json();
          loadBundle(data);
          setCombos(comboDefsToRules(data.combos ?? []));
          const startRoom = data.world?.rooms?.find((r: { id: string }) => r.id === data.world?.startingRoomId);
          playMusic(startRoom?.backgroundMusic ?? "");
          playAmbient(startRoom?.ambientSound ?? "");
          if (changelogRes && changelogRes.ok) {
            setChangelog(await changelogRes.json());
          }
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

  return <GameApp changelog={changelog} />;
}

export default App;
