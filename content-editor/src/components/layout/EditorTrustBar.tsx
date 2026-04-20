import { useMemo, useState } from "react";
import { saveBundleToContent } from "../../api/repoSync";
import { useBundleValidation } from "../../hooks/useBundleValidation";
import { useEditorBundle } from "../../hooks/useEditorBundle";
import { useHistoryStore } from "../../stores/historyStore";
import { useProjectStore } from "../../stores/projectStore";
import { getComparableBundleSignature } from "../../utils/bundleSignature";

function formatSyncStamp(value?: string): string {
  if (!value) {
    return "No repo sync yet";
  }
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EditorTrustBar() {
  const bundle = useEditorBundle();
  const issues = useBundleValidation();
  const lastRepoLoadAt = useProjectStore((state) => state.lastRepoLoadAt);
  const lastRepoSaveAt = useProjectStore((state) => state.lastRepoSaveAt);
  const lastSyncedBundleSignature = useProjectStore((state) => state.lastSyncedBundleSignature);
  const markRepoSaved = useProjectStore((state) => state.markRepoSaved);
  const pastCount = useHistoryStore((state) => state.past.length);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const currentSignature = useMemo(
    () => getComparableBundleSignature(bundle),
    [bundle]
  );
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  const syncChip = !lastSyncedBundleSignature
    ? { tone: "warn", text: pastCount > 0 ? "Local changes not saved to content/" : "Repo sync not established" }
    : currentSignature === lastSyncedBundleSignature
      ? { tone: "ok", text: "Matches content/" }
      : { tone: "warn", text: "Unsynced editor changes" };
  const hasUnsyncedChanges = !lastSyncedBundleSignature
    ? pastCount > 0
    : currentSignature !== lastSyncedBundleSignature;

  const validationChip =
    errorCount > 0
      ? { tone: "error", text: `${errorCount} error${errorCount === 1 ? "" : "s"}` }
      : warningCount > 0
        ? { tone: "warn", text: `${warningCount} warning${warningCount === 1 ? "" : "s"}` }
        : { tone: "ok", text: "Validation clear" };

  const latestSyncText =
    lastRepoSaveAt && (!lastRepoLoadAt || lastRepoSaveAt >= lastRepoLoadAt)
      ? `Saved to content/ ${formatSyncStamp(lastRepoSaveAt)}`
      : lastRepoLoadAt
        ? `Loaded from content/ ${formatSyncStamp(lastRepoLoadAt)}`
        : "Use Export / Import to sync with content/";

  const handleSave = async () => {
    setSaveBusy(true);
    setSaveStatus(null);
    try {
      const payload = await saveBundleToContent(bundle);
      if (!payload.ok) {
        setSaveStatus(payload.message ?? "Failed to save to content/");
        return;
      }
      markRepoSaved(bundle);
      const warningCount = payload.issues?.filter((issue) => issue.severity === "warning").length ?? 0;
      setSaveStatus(
        warningCount > 0
          ? `Saved with ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
          : "Saved to content/."
      );
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="editor-trust-bar">
      <div className="editor-trust-bar-meta">
        <span className={`editor-trust-chip editor-trust-chip--${syncChip.tone}`}>{syncChip.text}</span>
        <span className={`editor-trust-chip editor-trust-chip--${validationChip.tone}`}>
          {validationChip.text}
        </span>
        <span className="editor-trust-chip editor-trust-chip--neutral">{latestSyncText}</span>
        {saveStatus ? <span className="editor-trust-chip editor-trust-chip--neutral">{saveStatus}</span> : null}
      </div>
      <div className="editor-trust-bar-actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saveBusy || !hasUnsyncedChanges}
        >
          {saveBusy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
