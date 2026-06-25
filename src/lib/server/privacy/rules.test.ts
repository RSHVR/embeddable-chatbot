import { describe, it, expect } from "vitest";
import {
  quickPrivacyCheck,
  classifyOwnerReply,
  type PrivacyConfig,
} from "./rules";

const cfg: PrivacyConfig = { ownerNames: ["veer"], sendKeyword: "SEND" };

describe("quickPrivacyCheck", () => {
  it("approves a clean response", () => {
    expect(quickPrivacyCheck("We open at 9am.", cfg).approved).toBe(true);
  });
  it("rejects PRIVATE CONVERSATION tags", () => {
    expect(
      quickPrivacyCheck("<PRIVATE CONVERSATION>x</PRIVATE CONVERSATION>", cfg)
        .approved,
    ).toBe(false);
  });
  it("rejects the SEND protocol keyword (uppercase only)", () => {
    expect(quickPrivacyCheck("The owner said SEND", cfg).approved).toBe(false);
    expect(quickPrivacyCheck("I will send you details", cfg).approved).toBe(
      true,
    );
  });
  it("rejects leak phrases", () => {
    for (const r of [
      "he said yes",
      "she said no",
      "apparently he is busy",
      "I checked with the team",
    ]) {
      expect(quickPrivacyCheck(r, cfg).approved).toBe(false);
    }
  });
  it("rejects configured owner names", () => {
    expect(quickPrivacyCheck("Veer told me to tell you", cfg).approved).toBe(
      false,
    );
  });
  it("does not flag owner name when not configured", () => {
    expect(quickPrivacyCheck("Veer is a nice name", {}).approved).toBe(true);
  });
  it("honors extra leak patterns", () => {
    const c: PrivacyConfig = { extraLeakPatterns: [/\bsecret\b/i] };
    expect(quickPrivacyCheck("this is a secret", c).approved).toBe(false);
  });
});

describe("classifyOwnerReply", () => {
  it("detects SEND anywhere, case-insensitive", () => {
    expect(classifyOwnerReply("ok SEND it", cfg).isSend).toBe(true);
    expect(classifyOwnerReply("send", cfg).isSend).toBe(true);
  });
  it("treats normal replies as private", () => {
    expect(classifyOwnerReply("tell them 9am", cfg).isSend).toBe(false);
  });
});
