import { describe, it, expect } from "vitest";
import { validatePasswordStrength } from "../../src/signer/password-strength.js";

describe("password-strength", () => {
  it("accepts a strong password", () => {
    const result = validatePasswordStrength("MyStr0ng!Pass#99");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects password shorter than 12 characters", () => {
    const result = validatePasswordStrength("Sh0rt!Pa");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least 12"))).toBe(true);
  });

  it("rejects password exactly 11 characters", () => {
    const result = validatePasswordStrength("Abcde!12345");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least 12"))).toBe(true);
  });

  it("accepts password exactly 12 characters", () => {
    const result = validatePasswordStrength("Abcde!123456");
    expect(result.valid).toBe(true);
  });

  it("rejects password missing uppercase", () => {
    const result = validatePasswordStrength("alllowercase1!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("uppercase"))).toBe(true);
  });

  it("rejects password missing lowercase", () => {
    const result = validatePasswordStrength("ALLUPPERCASE1!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("lowercase"))).toBe(true);
  });

  it("rejects password missing digit", () => {
    const result = validatePasswordStrength("NoDigitsHere!!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("digit"))).toBe(true);
  });

  it("rejects password missing special character", () => {
    const result = validatePasswordStrength("NoSpecialChar1A");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("special"))).toBe(true);
  });

  it("rejects common weak password (case-insensitive)", () => {
    const result = validatePasswordStrength("password1234!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too common"))).toBe(true);
  });

  it("rejects common password regardless of case", () => {
    const r1 = validatePasswordStrength("qwerty12345!");
    expect(r1.errors.some((e) => e.includes("too common"))).toBe(true);
  });

  it("collects multiple errors at once", () => {
    const result = validatePasswordStrength("abc");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects empty password", () => {
    const result = validatePasswordStrength("");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least 12"))).toBe(true);
  });
});
