import { describe, expect, it } from "vitest";
import { checkImage, detectImageKind, MAX_IMAGE_BYTES, resolveStoragePath, storageRoot } from "./storage";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);

describe("storage path safety", () => {
  it("resolves normal paths inside the storage root", () => {
    const full = resolveStoragePath("branding/logo.png");
    expect(full.startsWith(storageRoot())).toBe(true);
  });

  it("rejects traversal, absolute paths, and null bytes", () => {
    expect(() => resolveStoragePath("../secrets.txt")).toThrow("Invalid storage path");
    expect(() => resolveStoragePath("branding/../../etc/passwd")).toThrow("Invalid storage path");
    expect(() => resolveStoragePath("/etc/passwd")).toThrow("Invalid storage path");
    expect(() => resolveStoragePath("a\0b")).toThrow("Invalid storage path");
    expect(() => resolveStoragePath("")).toThrow("Invalid storage path");
  });
});

describe("image validation", () => {
  it("identifies PNG, JPEG, and WebP by their bytes", () => {
    expect(detectImageKind(PNG)).toBe("png");
    expect(detectImageKind(JPG)).toBe("jpg");
    expect(detectImageKind(WEBP)).toBe("webp");
  });

  it("rejects other content even if it claims to be an image", () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    expect(detectImageKind(html)).toBeNull();
    const result = checkImage({ size: html.length }, html);
    expect(result.ok).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(checkImage({ size: 0 }, PNG).ok).toBe(false);
    expect(checkImage({ size: MAX_IMAGE_BYTES + 1 }, PNG).ok).toBe(false);
    expect(checkImage({ size: 1024 }, PNG)).toEqual({ ok: true, kind: "png" });
  });
});

