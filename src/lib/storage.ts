import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Local file storage for logos, signatures, and generated PDFs. Every path is resolved
// inside STORAGE_DIR, so a crafted filename cannot read or write elsewhere on disk.
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "storage");

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function storageRoot() {
  return ROOT;
}

/** Resolves a path relative to the storage root. Throws if it escapes that root. */
export function resolveStoragePath(relative: string): string {
  if (!relative || path.isAbsolute(relative) || relative.includes("\0")) {
    throw new Error("Invalid storage path");
  }
  const full = path.resolve(ROOT, relative);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return full;
}

export type ImageKind = "png" | "jpg" | "webp";

/** Identifies the image format from its leading bytes. Browser-supplied MIME types are not trusted. */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export type ImageCheck = { ok: true; kind: ImageKind } | { ok: false; error: string };

export function checkImage(file: { size: number }, bytes: Uint8Array): ImageCheck {
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Images must be 2 MB or smaller." };
  const kind = detectImageKind(bytes);
  if (!kind) return { ok: false, error: "Upload a PNG, JPEG, or WebP image." };
  return { ok: true, kind };
}

/** Returns a Cloudflare storage provider (Workers KV or R2) if running on Cloudflare Workers, otherwise null. */
async function getCloudflareStorage(): Promise<
  | { type: "kv"; client: any }
  | { type: "r2"; client: any }
  | null
> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx?.env as Record<string, any>;
    if (env?.STORAGE_KV) return { type: "kv", client: env.STORAGE_KV };
    if (env?.STORAGE_BUCKET) return { type: "r2", client: env.STORAGE_BUCKET };
    return null;
  } catch {
    return null;
  }
}

/** Saves a validated image under `folder` with a random name. Returns the relative path. */
export async function saveImage(file: File, folder: string): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(file, bytes);
  if (!check.ok) throw new Error(check.error);

  const relative = path.posix.join(folder, `${randomUUID()}.${check.kind}`);
  const storage = await getCloudflareStorage();

  if (storage) {
    if (storage.type === "kv") {
      await storage.client.put(relative, bytes);
    } else {
      await storage.client.put(relative, bytes, {
        httpMetadata: { contentType: contentTypeFor(relative) },
      });
    }
    return relative;
  }

  const full = resolveStoragePath(relative);
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ full, bytes, { mode: 0o600 });
  return relative;
}

/** Writes bytes to a relative path inside storage, creating folders as needed. */
export async function writeStoredFile(relative: string, bytes: Buffer): Promise<void> {
  const storage = await getCloudflareStorage();
  if (storage) {
    if (storage.type === "kv") {
      await storage.client.put(relative, bytes);
    } else {
      await storage.client.put(relative, bytes, {
        httpMetadata: { contentType: contentTypeFor(relative) },
      });
    }
    return;
  }

  const full = resolveStoragePath(relative);
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ full, bytes, { mode: 0o600 });
}

export async function readStoredFile(relative: string): Promise<Buffer> {
  const storage = await getCloudflareStorage();
  if (storage) {
    if (storage.type === "kv") {
      const arrayBuffer = await storage.client.get(relative, { type: "arrayBuffer" });
      if (!arrayBuffer) throw new Error(`File not found in storage: ${relative}`);
      return Buffer.from(arrayBuffer);
    } else {
      const obj = await storage.client.get(relative);
      if (!obj) throw new Error(`File not found in storage: ${relative}`);
      const arrayBuffer = await obj.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  return fs.readFile(/*turbopackIgnore: true*/ resolveStoragePath(relative));
}

/** Removes a stored file. A missing file is not an error. */
export async function deleteStoredFile(relative: string | null | undefined) {
  if (!relative) return;
  const storage = await getCloudflareStorage();
  if (storage) {
    await storage.client.delete(relative);
    return;
  }

  try {
    await fs.unlink(/*turbopackIgnore: true*/ resolveStoragePath(relative));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function contentTypeFor(relative: string): string {
  const ext = path.extname(relative).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}
