import { AlertCircle, CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
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
  const savedSessionKey = sessionStorage.getItem(SESSION_KEY_NAME);
  const hasSavedSessionKey = Boolean(savedSessionKey && savedSessionKey === key.trim());
  const connectionReady = status.configured || hasSavedSessionKey || testState === "success";
  const canSave = hasEnteredKey ? hasSavedSessionKey || testState === "success" : status.configured;

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
    if (trimmed && testState !== "success" && !hasSavedSessionKey) return;
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
      description="Connect your Google AI Studio key for AI-assisted drafting."
      size="large"
    >
      <div className={`connection-card ${connectionReady ? "connection-card--ready" : ""}`}>
        <div className="connection-card__icon">
          <ShieldCheck aria-hidden="true" size={22} />
        </div>
        <div>
          <strong>
            {status.configured
              ? "Server connection available"
              : testState === "success"
                ? "Key verified"
                : hasSavedSessionKey
                  ? "Session key ready"
                  : hasEnteredKey
                    ? "Key ready to test"
                    : "Gemini setup required"}
          </strong>
          <p>
            {status.configured
              ? `No browser key is required. You can test the shared server connection below. Model: ${status.model}.`
              : testState === "success"
                ? `This key is ready to save for the current browser tab. Model: ${status.model}.`
                : hasSavedSessionKey
                  ? `A key is already saved in this browser tab. Test it again if the connection stops working. Model: ${status.model}.`
                  : hasEnteredKey
                    ? `Select Test connection to verify this key before saving it. Model: ${status.model}.`
                    : `Follow the three steps below to create and verify a key. Model: ${status.model}.`}
          </p>
        </div>
      </div>

      {!status.configured && (
        <section className="api-key-guide" aria-labelledby="api-key-guide-title">
          <div className="api-key-guide__header">
            <div>
              <p className="api-key-guide__eyebrow">One-time setup</p>
              <h3 id="api-key-guide-title">Get a Gemini API key</h3>
              <p>Create the key in Google AI Studio, then return here to verify it.</p>
            </div>
            <a
              className="button button--outline api-key-guide__link"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Open Google AI Studio
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          </div>

          <ol className="api-key-steps">
            <li>
              <span aria-hidden="true">1</span>
              <div><strong>Sign in</strong><p>Open Google AI Studio and sign in with your Google account.</p></div>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <div><strong>Create a key</strong><p>Choose or create a Google Cloud project, then select Create API key.</p></div>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <div><strong>Paste and verify</strong><p>Copy the key, paste it below, select Test connection, then save it.</p></div>
            </li>
          </ol>
        </section>
      )}

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
            placeholder={status.configured ? "Optional: use a different key" : "Paste your Google AI Studio key"}
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
          Your key is stored only in this browser tab. It is sent to the Render API only when you test the connection or use Gemini drafting, and is never included in the frontend bundle.
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
        <button className="button button--primary" type="button" onClick={handleSave} disabled={testState === "testing" || !canSave}>
          {status.configured && !hasEnteredKey ? "Use server connection" : "Save verified key"}
        </button>
      </div>
    </Modal>
  );
}
