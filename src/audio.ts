/**
 * Lightweight sound playback utility.
 * Caches Audio elements by path; uses cloneNode() to allow overlapping
 * identical sounds (e.g. rapid hits). Silently swallows all errors so
 * missing files or autoplay-policy blocks never crash the game.
 *
 * Ambient (looping) sounds:
 *   playAmbient(path) — start or swap the looping background track.
 *   stopAmbient()     — stop the current ambient track.
 * Only one ambient track plays at a time. Calling playAmbient with the
 * same path that is already playing is a no-op.
 */

const cache = new Map<string, HTMLAudioElement>();

// ── Ambient (looping) track state ────────────────────────────────────────────
let ambientPath: string | null = null;
let ambientEl: HTMLAudioElement | null = null;

export function playAmbient(path: string, volume = 0.4): void {
  if (!path) { stopAmbient(); return; }
  if (path === ambientPath && ambientEl && !ambientEl.paused) return; // already playing
  stopAmbient();
  try {
    const el = new Audio(path);
    el.loop = true;
    el.volume = Math.max(0, Math.min(1, volume));
    el.play().catch(() => {});
    ambientEl = el;
    ambientPath = path;
  } catch {
    // Ignore
  }
}

export function stopAmbient(): void {
  if (ambientEl) {
    try { ambientEl.pause(); ambientEl.currentTime = 0; } catch { /* ignore */ }
    ambientEl = null;
  }
  ambientPath = null;
}

// ── One-shot sounds ───────────────────────────────────────────────────────────

export function playSound(path: string, volume = 1): void {
  if (!path) return;
  try {
    if (!cache.has(path)) {
      cache.set(path, new Audio(path));
    }
    const clone = cache.get(path)!.cloneNode() as HTMLAudioElement;
    clone.volume = Math.max(0, Math.min(1, volume));
    clone.play().catch(() => {
      // Swallow autoplay-policy or missing-file errors silently
    });
  } catch {
    // Ignore any other errors (e.g. invalid path format)
  }
}
