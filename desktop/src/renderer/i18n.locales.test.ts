import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

const NS = [
  "common",
  "setup",
  "activity",
  "security",
  "settings",
  "errors",
  "pairing",
  "modals",
  "contactsPage",
] as const;

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, p));
    } else {
      keys.push(p);
    }
  }
  return keys.sort();
}

describe("desktop locales", () => {
  const localesRoot = join(here, "..", "..", "locales");

  for (const lang of ["en", "zh-CN"] as const) {
    it(`parses all JSON for ${lang}`, async () => {
      const dir = join(localesRoot, lang);
      for (const ns of NS) {
        const raw = await readFile(join(dir, `${ns}.json`), "utf-8");
        expect(() => JSON.parse(raw)).not.toThrow();
      }
    });
  }

  it("en and zh-CN share the same leaf keys per namespace", async () => {
    for (const ns of NS) {
      const enRaw = await readFile(join(localesRoot, "en", `${ns}.json`), "utf-8");
      const zhRaw = await readFile(join(localesRoot, "zh-CN", `${ns}.json`), "utf-8");
      const enKeys = collectKeys(JSON.parse(enRaw));
      const zhKeys = collectKeys(JSON.parse(zhRaw));
      expect(zhKeys).toEqual(enKeys);
    }
  });

  it("lists expected namespace files", async () => {
    const enDir = join(localesRoot, "en");
    const names = (await readdir(enDir)).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
    for (const ns of NS) {
      expect(names).toContain(ns);
    }
  });
});
