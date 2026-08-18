import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { testAiConnection } from "../api";
import type { AiStatus } from "../types";
import { Modal } from "./Modal";

export const SESSION_KEY_NAME = "accomplishpro_gemini_key";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  status: AiStatus;
  onSaved: () => void;
}

export function SettingsModal({ open, onClose, status, onSaved }: SettingsModalProps) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (open) {
      setKey(sessionStorage.getItem(SESSION_KEY_NAME) ?? "");
      setTestState("idle");
      setTestMessage("");
      setShowKey(false);
    }
  }, [open]);

  const hasEnteredKey = Boolean(key.trim());
  const connectionReady = status.configured || hasEnteredKey;

  const handleTest = async () => {
    setTestState("testing");
    setTestMessage("");
    try {
      const result = await testAiConnection(key.trim() || undefined);
      setTestState("success");
      setTestMessage(`Connection verified with ${result.model}.`);
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : "Could not verify the Gemini connection.");
    }
  };

  const handleSave = () => {
    const trimmed = key.trim();
    if (trimmed) sessionStorage.setItem(SESSION_KEY_NAME, trimmed);
    else sessionStorage.removeItem(SESSION_KEY_NAME);
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gemini settings"
      description="Connect a free Google AI Studio key for AI-assisted drafting."
    >
      <div className={`connection-card ${connectionReady ? "connection-card--ready" : ""}`}>
        <div className="connection-card__icon">
          <ShieldCheck aria-hidden="true" size={22} />
        </div>
        <div>
          <strong>{status.configured ? "Server key configured" : hasEnteredKey ? "Session key entered" : "Gemini setup required"}</strong>
          <p>
            {status.configured
              ? `Test the server connection before drafting. Model: ${status.model}.`
              : hasEnteredKey
                ? `Test this key before saving it for the browser session. Model: ${status.model}.`
                : `Enter a Google AI Studio key below, then test the connection. Model: ${status.model}.`}
          </p>
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="gemini-key">Gemini API key</label>
        <div className="input-with-action">
          <KeyRound aria-hidden="true" size={18} />
          <input
            id="gemini-key"
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setTestState("idle");
              setTestMessage("");
            }}
            placeholder={status.configured ? "Server key already configured" : "AIza..."}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="input-action"
            type="button"
            onClick={() => setShowKey((visible) => !visible)}
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
          </button>
        </div>
        <p className="field-help">
          A key entered here stays only in this browser tab and is sent to your local backend only when you use AI.
        </p>
      </div>

      {testState === "success" && (
        <div className="inline-alert inline-alert--success" role="status">
          <CheckCircle2 aria-hidden="true" size={20} />
          <p>{testMessage}</p>
        </div>
      )}

      {testState === "error" && (
        <div className="inline-alert inline-alert--error" role="alert">
          <AlertCircle aria-hidden="true" size={20} />
          <p>{testMessage}</p>
        </div>
      )}

      <div className="modal__actions">
        <button className="button button--ghost" type="button" onClick={onClose} disabled={testState === "testing"}>
          Cancel
        </button>
        <button
          className="button button--outline"
          type="button"
          onClick={handleTest}
          disabled={testState === "testing" || (!status.configured && !hasEnteredKey)}
        >
          {testState === "testing" && <LoaderCircle className="spin" aria-hidden="true" size={17} />}
          {testState === "testing" ? "Testing…" : "Test connection"}
        </button>
        <button className="button button--primary" type="button" onClick={handleSave} disabled={testState === "testing"}>
          Save for this session
        </button>
      </div>
    </Modal>
  );
}
