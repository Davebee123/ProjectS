import { PUBLIC_ASSET_MANIFEST } from "../generated/publicAssetManifest";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "ogg", "wav", "flac", "m4a"]);

/** Dynamic cache: populated from /api/content/public-assets at runtime.
 *  Falls back to the static PUBLIC_ASSET_MANIFEST if the API is unavailable
 *  (e.g. production build). */
let dynamicAssetCache: readonly string[] | null = null;
let dynamicFetchPromise: Promise<readonly string[]> | null = null;

export async function loadPublicAssets(force = false): Promise<readonly string[]> {
  if (!force && dynamicAssetCache) return dynamicAssetCache;
  if (!force && dynamicFetchPromise) return dynamicFetchPromise;
  dynamicFetchPromise = (async () => {
    try {
      const res = await fetch("/api/content/public-assets", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { ok?: boolean; assets?: string[] };
      if (body.ok && Array.isArray(body.assets)) {
        dynamicAssetCache = body.assets;
        return body.assets;
      }
      throw new Error("bad response");
    } catch {
      dynamicAssetCache = PUBLIC_ASSET_MANIFEST;
      return PUBLIC_ASSET_MANIFEST;
    } finally {
      dynamicFetchPromise = null;
    }
  })();
  return dynamicFetchPromise;
}

function getAssetList(): readonly string[] {
  return dynamicAssetCache ?? PUBLIC_ASSET_MANIFEST;
}

function getExtension(path: string): string {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function matchesAccept(path: string, accept?: string): boolean {
  if (!accept) {
    return true;
  }

  const extension = getExtension(path);
  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.some((token) => {
    if (token === "image/*") {
      return IMAGE_EXTENSIONS.has(extension);
    }
    if (token === "audio/*") {
      return AUDIO_EXTENSIONS.has(extension);
    }
    if (token.startsWith(".")) {
      return extension === token.slice(1);
    }
    return false;
  });
}

function scorePath(path: string, query: string, normalizedPrefix: string): number {
  let score = 0;

  if (normalizedPrefix && path.startsWith(`/${normalizedPrefix}`)) {
    score -= 20;
  }

  if (query) {
    if (path === query) {
      score -= 30;
    } else if (path.startsWith(query)) {
      score -= 20;
    } else if (path.includes(query)) {
      score -= 10;
    }
  }

  return score;
}

export interface PublicAssetOption {
  path: string;
  label: string;
  meta: string;
}

export function listPublicAssets(options?: {
  accept?: string;
  pathPrefix?: string;
  query?: string;
}): PublicAssetOption[] {
  const normalizedPrefix = options?.pathPrefix?.replace(/^\/+|\/+$/g, "").toLowerCase() ?? "";
  const query = options?.query?.trim().toLowerCase() ?? "";

  return getAssetList()
    .filter((path) => matchesAccept(path, options?.accept))
    .filter((path) => {
      if (!query) {
        return true;
      }
      return path.toLowerCase().includes(query);
    })
    .map((path) => ({
      path,
      label: path.split("/").at(-1) ?? path,
      meta: path.lastIndexOf("/") > 0 ? path.slice(1, path.lastIndexOf("/")) : "public root",
      score: scorePath(path.toLowerCase(), query, normalizedPrefix),
    }))
    .sort((a, b) => (a.score - b.score) || a.path.localeCompare(b.path))
    .map(({ score: _score, ...option }) => option);
}
