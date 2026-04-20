import { useMemo } from "react";
import { validateBundle, type ValidationIssue } from "../../../shared/content/validation";
import { useEditorBundle } from "./useEditorBundle";

export function useBundleValidation(): ValidationIssue[] {
  const bundle = useEditorBundle();

  return useMemo(() => {
    try {
      return validateBundle(bundle);
    } catch (error) {
      return [
        {
          severity: "error",
          message: error instanceof Error ? `Validation failed: ${error.message}` : "Validation failed unexpectedly",
        },
      ];
    }
  }, [bundle]);
}
