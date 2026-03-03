/**
 * Lightweight sound playback utility.
 * Caches Audio elements by path; uses cloneNode() to allow overlapping
 * identical sounds (e.g. rapid hits). Silently swallows all errors so
 * missing files or autoplay-policy blocks never crash the game.
 */

const cache = new Map<string, HTMLAudioElement>();

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
