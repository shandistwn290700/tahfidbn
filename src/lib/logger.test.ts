import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "log-test-"));
process.env.LOG_DIR = dir;
process.env.LOG_RETENTION_DAYS = "30";

const { log, audit, redact, pruneOldLogs } = await import("./logger.ts");
const { PublicError, publicMessage } = await import("./errors.ts");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function readChannel(channel: "app" | "audit"): Record<string, unknown>[] {
  const file = readdirSync(dir).find((name) => name.startsWith(`${channel}-`));
  if (!file) return [];
  return readFileSync(join(dir, file), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

describe("redact", () => {
  test("menyembunyikan kolom rahasia di semua kedalaman", () => {
    const out = redact({
      username: "admin",
      password: "rahasia123",
      nested: { refresh_token: "abc", Authorization: "Basic xyz", list: [{ client_secret: "s" }] },
    }) as any;
    expect(out.username).toBe("admin");
    expect(out.password).toBe("[disembunyikan]");
    expect(out.nested.refresh_token).toBe("[disembunyikan]");
    expect(out.nested.Authorization).toBe("[disembunyikan]");
    expect(out.nested.list[0].client_secret).toBe("[disembunyikan]");
  });

  test("menyembunyikan kredensial Bearer/Basic di dalam teks", () => {
    expect(redact("gagal: Bearer eyJhbGciOi.xyz")).toBe("gagal: Bearer [disembunyikan]");
  });
});

describe("log & audit", () => {
  test("galat masuk log app lengkap dengan stack dan kode rujukan", () => {
    const ref = log.error("uji.galat", new Error("SQLITE_ERROR: no such table x"));
    const entry = readChannel("app").find((e) => e.ref === ref) as any;
    expect(entry.level).toBe("error");
    expect(entry.error.stack).toContain("SQLITE_ERROR");
  });

  test("audit ditulis ke berkas terpisah tanpa password", () => {
    audit(null, "uji.audit", { username: "guru1", password: "bocor" });
    const entry = readChannel("audit").find((e) => e.event === "uji.audit") as any;
    expect(entry.username).toBe("guru1");
    expect(entry.password).toBe("[disembunyikan]");
    expect(readChannel("app").some((e) => e.event === "uji.audit")).toBe(false);
  });

  test("folder dan berkas log hanya bisa dibaca pemiliknya", () => {
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    for (const name of readdirSync(dir)) {
      expect(statSync(join(dir, name)).mode & 0o777).toBe(0o600);
    }
  });

  test("berkas log yang melewati masa simpan dihapus", () => {
    writeFileSync(join(dir, "app-2000-01-01.log"), "");
    writeFileSync(join(dir, "catatan-lain.txt"), "");
    pruneOldLogs();
    const names = readdirSync(dir);
    expect(names).not.toContain("app-2000-01-01.log");
    expect(names).toContain("catatan-lain.txt");
  });
});

describe("publicMessage", () => {
  test("PublicError ditampilkan apa adanya", () => {
    expect(publicMessage(new PublicError("Nama situs tidak boleh kosong."), "Gagal.")).toBe(
      "Nama situs tidak boleh kosong."
    );
  });

  test("galat internal disembunyikan dan diganti kode rujukan", () => {
    const message = publicMessage(new Error("Gagal menghubungi Canva (500): {internal}"), "Gagal.");
    expect(message).not.toContain("internal");
    const ref = /kode galat: ([0-9a-f]{8})/.exec(message)?.[1];
    expect(ref).toBeDefined();
    expect(readChannel("app").some((e) => e.ref === ref)).toBe(true);
  });
});
