import { useEffect, useRef } from "react";
import { saveReport } from "../api";
import type { Report, SaveState } from "../types";

export function useAutosave(
  report: Report | null,
  enabled: boolean,
  onStateChange: (state: SaveState) => void,
  onSaved: (report: Report) => void,
  onError: (message: string) => void,
): void {
  const requestVersion = useRef(0);
  const callbacks = useRef({ onStateChange, onSaved, onError });
  callbacks.current = { onStateChange, onSaved, onError };

  useEffect(() => {
    if (!report || !enabled) return;
    const version = ++requestVersion.current;
    callbacks.current.onStateChange("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const saved = await saveReport(report);
        if (requestVersion.current !== version) return;
        callbacks.current.onSaved(saved);
        callbacks.current.onStateChange("saved");
      } catch (error) {
        if (requestVersion.current !== version) return;
        callbacks.current.onStateChange("error");
        callbacks.current.onError(error instanceof Error ? error.message : "Unable to save this draft.");
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [report, enabled]);
}
