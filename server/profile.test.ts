import { describe, expect, it } from "vitest";
import { generateRandomUsername, isValidUsername } from "@shared/profile";

describe("profile usernames", () => {
  it("accepts valid usernames and rejects invalid formats", () => {
    expect(isValidUsername("swift-trader-123")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("name with spaces")).toBe(false);
    expect(isValidUsername("name!".repeat(5))).toBe(false);
  });

  it("generates a username accepted by the shared validator", () => {
    const username = generateRandomUsername();
    expect(isValidUsername(username)).toBe(true);
    expect(username).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
  });
});
