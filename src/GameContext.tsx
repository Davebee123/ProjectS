import { createContext, useContext, type Dispatch } from "react";
import type { GameState, GameAction } from "./state";
import type { ChangelogData } from "./data/changelog";

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  changelog: ChangelogData | null;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameContext.Provider");
  return ctx;
}
