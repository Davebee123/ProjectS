import { useEffect, useMemo } from "react";
import { useEditorBundle } from "./useEditorBundle";
import { useHistoryStore } from "../stores/historyStore";
import { useProjectStore } from "../stores/projectStore";
import { getComparableBundleSignature } from "../utils/bundleSignature";

export function useUnsavedChangesWarning() {
  const bundle = useEditorBundle();
  const pastCount = useHistoryStore((state) => state.past.length);
  const lastSyncedBundleSignature = useProjectStore((state) => state.lastSyncedBundleSignature);

  const hasUnsavedChanges = useMemo(() => {
    const currentSignature = getComparableBundleSignature(bundle);
    if (!lastSyncedBundleSignature) {
      return pastCount > 0;
    }
    return currentSignature !== lastSyncedBundleSignature;
  }, [bundle, lastSyncedBundleSignature, pastCount]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers ignore custom text here, but setting returnValue still triggers the native prompt.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
