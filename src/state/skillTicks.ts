import type { SkillState } from "../data/bridge";

function buildEvenlyDistributedTickMoments(durationMs: number, tickCount: number): number[] {
  if (durationMs <= 0 || tickCount <= 0) {
    return [];
  }

  return Array.from({ length: tickCount }, (_, index) =>
    Math.max(1, Math.min(durationMs, Math.round(((index + 1) / tickCount) * durationMs)))
  );
}

export function getSkillTickMoments(
  skill: Pick<SkillState, "usageProfile" | "effects">,
  durationMs: number
): number[] {
  if (durationMs <= 0) {
    return [];
  }

  const explicitIntervalMs = skill.usageProfile?.castTickIntervalMs;
  if (explicitIntervalMs && explicitIntervalMs > 0) {
    const moments: number[] = [];
    for (let elapsed = explicitIntervalMs; elapsed < durationMs; elapsed += explicitIntervalMs) {
      moments.push(elapsed);
    }
    moments.push(durationMs);
    return [...new Set(moments.map((moment) => Math.max(1, Math.min(durationMs, Math.round(moment)))))];
  }

  const fallbackTickCount = Math.max(
    0,
    ...(skill.effects ?? [])
      .filter((effect) => effect.trigger === "on_tick")
      .map((effect) => effect.hitCount ?? 0)
  );

  return buildEvenlyDistributedTickMoments(durationMs, fallbackTickCount);
}

export function getSkillTickMarkerPercents(
  skill: Pick<SkillState, "usageProfile" | "effects">,
  durationMs: number
): number[] {
  if (durationMs <= 0) {
    return [];
  }

  return getSkillTickMoments(skill, durationMs).map((moment) =>
    Math.max(0, Math.min(100, (moment / durationMs) * 100))
  );
}
