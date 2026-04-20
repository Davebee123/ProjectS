import type { GameContentBundle } from "../schema/types";
import type { ValidationIssue } from "../../../shared/content/validation";

export interface RepoSyncResponse {
  ok: boolean;
  message?: string;
  issues?: ValidationIssue[];
  bundle?: GameContentBundle;
}

export async function saveBundleToContent(bundle: GameContentBundle): Promise<RepoSyncResponse> {
  const response = await fetch("/api/content/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bundle),
  });
  const payload = (await response.json()) as RepoSyncResponse;
  if (!response.ok) {
    const firstError = payload.issues?.find((issue) => issue.severity === "error");
    return {
      ...payload,
      ok: false,
      message: firstError?.message ?? payload.message ?? "Failed to save to content/",
    };
  }
  return payload;
}
