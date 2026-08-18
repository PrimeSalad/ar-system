// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAiConnection } from "../api";
import { SESSION_KEY_NAME, SettingsModal } from "./SettingsModal";

vi.mock("../api", () => ({ testAiConnection: vi.fn() }));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("Gemini settings", () => {
  it("tests an entered key and shows a verified connection", async () => {
    vi.mocked(testAiConnection).mockResolvedValue({ ok: true, model: "gemini-3.5-flash" });

    render(
      <SettingsModal
        open
        status={{ configured: false, model: "gemini-3.5-flash" }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Gemini API key"), { target: { value: "test-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => expect(testAiConnection).toHaveBeenCalledWith("test-key"));
    expect(await screen.findByText("Connection verified with gemini-3.5-flash.")).toBeInTheDocument();
  });

  it("saves a session key only in session storage", () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
      <SettingsModal
        open
        status={{ configured: false, model: "gemini-3.5-flash" }}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("Gemini API key"), { target: { value: "  session-key  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save for this session" }));

    expect(sessionStorage.getItem(SESSION_KEY_NAME)).toBe("session-key");
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
