export function toPublicAssetPath(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return normalized
    .replace(/^\/images\/interactables\//i, "/Interactable Images/")
    .replace(/^\/images\/Background/i, "/Background Images/Background");
}
