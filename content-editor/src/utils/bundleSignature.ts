import type { GameContentBundle } from "../schema/types";

export function getComparableBundleSignature(bundle: GameContentBundle): string {
  return JSON.stringify({
    ...bundle,
    exportedAt: "",
  });
}
