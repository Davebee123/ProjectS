import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WeatherTemplate } from "../schema/types";

interface WeatherState {
  weathers: WeatherTemplate[];
  addWeather: (weather: WeatherTemplate) => void;
  updateWeather: (id: string, patch: Partial<WeatherTemplate>) => void;
  removeWeather: (id: string) => void;
  loadWeathers: (weathers: WeatherTemplate[]) => void;
}

export function createDefaultWeather(id: string, name: string): WeatherTemplate {
  return {
    id,
    name,
    description: "",
    icon: "",
    weight: 1,
    energyRegenMult: 1.0,
    manaRegenMult: 1.0,
    successChanceMod: 0,
  };
}

const SEED_WEATHERS: WeatherTemplate[] = [
  {
    id: "clear",
    name: "Clear",
    description: "Clear skies with good visibility.",
    icon: "\u2600",
    weight: 4,
    energyRegenMult: 1.0,
    manaRegenMult: 1.0,
    successChanceMod: 0,
  },
  {
    id: "cloudy",
    name: "Cloudy",
    description: "Overcast skies with muted light.",
    icon: "\u2601",
    weight: 3,
    energyRegenMult: 1.0,
    manaRegenMult: 1.1,
    successChanceMod: 0,
  },
  {
    id: "rainy",
    name: "Rainy",
    description: "Steady rainfall dampens the land.",
    icon: "\uD83C\uDF27\uFE0F",
    weight: 2,
    energyRegenMult: 0.85,
    manaRegenMult: 1.25,
    successChanceMod: -5,
  },
  {
    id: "stormy",
    name: "Stormy",
    description: "Thunder and lightning rage overhead.",
    icon: "\u26C8",
    weight: 1,
    energyRegenMult: 0.7,
    manaRegenMult: 1.5,
    successChanceMod: -10,
  },
];

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set) => ({
      weathers: SEED_WEATHERS,

      addWeather: (weather) =>
        set((s) => ({ weathers: [...s.weathers, weather] })),

      updateWeather: (id, patch) =>
        set((s) => ({
          weathers: s.weathers.map((w) =>
            w.id === id ? { ...w, ...patch } : w
          ),
        })),

      removeWeather: (id) =>
        set((s) => ({ weathers: s.weathers.filter((w) => w.id !== id) })),

      loadWeathers: (weathers) => set({ weathers }),
    }),
    {
      name: "editor-weathers",
      partialize: (state) => ({ weathers: state.weathers }),
    }
  )
);
