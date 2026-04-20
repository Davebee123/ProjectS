/**
 * Lightweight sound playback utility.
 * Caches Audio elements by path; uses cloneNode() to allow overlapping
 * identical sounds (e.g. rapid hits). Silently swallows all errors so
 * missing files or autoplay-policy blocks never crash the game.
 *
 * Looping audio:
 *   playMusic(path)   - start or swap the looping music track.
 *   stopMusic()       - stop the current music track.
 *   playAmbient(path) - start or swap the looping ambient track.
 *   stopAmbient()     - stop the current ambient track.
 * Music and ambient use separate channels and can play together.
 */

const cache = new Map<string, HTMLAudioElement>();
const activeOneShots = new Set<HTMLAudioElement>();
const pendingOneShots: Array<{ path: string; volume: number }> = [];

let musicPath: string | null = null;
let musicEl: HTMLAudioElement | null = null;

let ambientPath: string | null = null;
let ambientEl: HTMLAudioElement | null = null;
let unlockListenersAttached = false;
let oneShotUnlockListenersAttached = false;

function retryLoopingAudioPlayback(): void {
  musicEl?.play().catch(() => {});
  ambientEl?.play().catch(() => {});
  weatherEl?.play().catch(() => {});
}

function ensureLoopingAudioUnlock(): void {
  if (unlockListenersAttached || typeof window === "undefined") {
    return;
  }

  const retry = () => {
    retryLoopingAudioPlayback();
    if ((!musicEl || !musicEl.paused) && (!ambientEl || !ambientEl.paused)) {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      unlockListenersAttached = false;
    }
  };

  unlockListenersAttached = true;
  window.addEventListener("pointerdown", retry, { passive: true });
  window.addEventListener("keydown", retry);
}

function playOneShot(path: string, volume: number, allowRetry: boolean): void {
  if (!path) return;

  try {
    if (!cache.has(path)) {
      const cached = new Audio(path);
      cached.preload = "auto";
      cache.set(path, cached);
    }

    const cached = cache.get(path)!;
    const src = cached.currentSrc || cached.src || path;
    const el = new Audio(src);
    el.preload = "auto";
    el.volume = Math.max(0, Math.min(1, volume));
    activeOneShots.add(el);

    const cleanup = () => {
      activeOneShots.delete(el);
    };

    el.addEventListener("ended", cleanup, { once: true });
    el.addEventListener("error", cleanup, { once: true });

    el.play().catch(() => {
      cleanup();
      if (allowRetry && typeof window !== "undefined") {
        pendingOneShots.push({ path, volume });
        ensureOneShotAudioUnlock();
      }
    });
  } catch {
    // Ignore invalid path or browser audio failures.
  }
}

function flushPendingOneShots(): void {
  const queued = pendingOneShots.splice(0, pendingOneShots.length);
  for (const pending of queued) {
    playOneShot(pending.path, pending.volume, false);
  }
}

function ensureOneShotAudioUnlock(): void {
  if (oneShotUnlockListenersAttached || typeof window === "undefined") {
    return;
  }

  const retry = () => {
    flushPendingOneShots();
    window.removeEventListener("pointerdown", retry);
    window.removeEventListener("keydown", retry);
    oneShotUnlockListenersAttached = false;
  };

  oneShotUnlockListenersAttached = true;
  window.addEventListener("pointerdown", retry, { passive: true });
  window.addEventListener("keydown", retry);
}

export function playMusic(path: string, volume = 0.08): void {
  if (!path) {
    stopMusic();
    return;
  }
  if (path === musicPath && musicEl && !musicEl.paused) return;
  stopMusic();
  try {
    ensureLoopingAudioUnlock();
    const el = new Audio(path);
    el.loop = true;
    el.volume = Math.max(0, Math.min(1, volume));
    el.play().catch(() => {});
    musicEl = el;
    musicPath = path;
  } catch {
    // Ignore
  }
}

export function stopMusic(): void {
  if (musicEl) {
    try {
      musicEl.pause();
      musicEl.currentTime = 0;
    } catch {
      // Ignore
    }
    musicEl = null;
  }
  musicPath = null;
}

export function playAmbient(path: string, volume = 0.4): void {
  if (!path) {
    stopAmbient();
    return;
  }
  if (path === ambientPath && ambientEl && !ambientEl.paused) return;
  stopAmbient();
  try {
    ensureLoopingAudioUnlock();
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
    try {
      ambientEl.pause();
      ambientEl.currentTime = 0;
    } catch {
      // Ignore
    }
    ambientEl = null;
  }
  ambientPath = null;
}

export function playSound(path: string, volume = 1): void {
  playOneShot(path, volume, true);
}

/* ── Weather ambient channel ───────────────────────────────────────
 * Separate looping channel for weather sounds, independent of
 * music and room ambient. */

let weatherPath: string | null = null;
let weatherEl: HTMLAudioElement | null = null;

export function playWeatherAmbient(path: string, volume = 0.3, loop = true): void {
  if (!path) {
    stopWeatherAmbient();
    return;
  }
  if (path === weatherPath && weatherEl && !weatherEl.paused) return;
  stopWeatherAmbient();
  try {
    ensureLoopingAudioUnlock();
    const el = new Audio(path);
    el.loop = loop;
    el.volume = Math.max(0, Math.min(1, volume));
    el.play().catch(() => {});
    weatherEl = el;
    weatherPath = path;
  } catch {
    // Ignore
  }
}

export function stopWeatherAmbient(): void {
  if (weatherEl) {
    try {
      weatherEl.pause();
      weatherEl.currentTime = 0;
    } catch {
      // Ignore
    }
    weatherEl = null;
  }
  weatherPath = null;
}

/* ── Managed sound channels ─────────────────────────────────────────
 * A managed channel plays a single non-looping sound that can be
 * stopped early and won't stack if triggered again while playing. */

const managedChannels = new Map<string, HTMLAudioElement>();

/** Play a sound on a named channel. Stops any previous sound on
 *  the same channel first, preventing stacking. */
export function playManaged(channel: string, path: string, volume = 1): void {
  if (!path) return;
  stopManaged(channel);
  try {
    // Reuse cached source to avoid re-fetching
    if (!cache.has(path)) {
      const cached = new Audio(path);
      cached.preload = "auto";
      cache.set(path, cached);
    }
    const cached = cache.get(path)!;
    const src = cached.currentSrc || cached.src || path;
    const el = new Audio(src);
    el.preload = "auto";
    el.volume = Math.max(0, Math.min(1, volume));
    el.addEventListener("ended", () => { if (managedChannels.get(channel) === el) managedChannels.delete(channel); }, { once: true });
    el.addEventListener("error", () => { if (managedChannels.get(channel) === el) managedChannels.delete(channel); }, { once: true });
    managedChannels.set(channel, el);
    el.play().catch(() => { if (managedChannels.get(channel) === el) managedChannels.delete(channel); });
  } catch {
    // Ignore
  }
}

/** Stop a managed channel immediately. */
export function stopManaged(channel: string): void {
  const el = managedChannels.get(channel);
  if (el) {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      // Ignore
    }
    managedChannels.delete(channel);
  }
}
