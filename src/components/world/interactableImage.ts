export interface InteractableImageLike {
  image?: string;
  portraitImage?: string;
  imagePositionX?: number;
  imagePositionY?: number;
}

function clampImagePosition(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 50;
  }
  return Math.max(0, Math.min(100, value));
}

function normalizeInteractableImagePath(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized.replace(/^\/images\/interactables\//i, "/Interactable Images/");
}

export function getInteractableDisplayImageSrc(entry: InteractableImageLike): string | undefined {
  return normalizeInteractableImagePath(entry.image) || normalizeInteractableImagePath(entry.portraitImage);
}

export function getInteractableImageObjectPosition(
  imagePositionX?: number,
  imagePositionY?: number
): string {
  return `${clampImagePosition(imagePositionX)}% ${clampImagePosition(imagePositionY)}%`;
}
