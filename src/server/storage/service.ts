import "server-only";
import { createHash } from "node:crypto";
import type { UploadKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Actor } from "@/lib/action";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { validateImageUpload } from "./validate";

/** Kinds that anyone may view (marketplace imagery). Everything else requires authorisation. */
const PUBLIC_KINDS: UploadKind[] = ["LISTING_PHOTO", "PRODUCT_PHOTO"];

const supabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);

export async function saveImage(actor: Actor, file: File, kind: UploadKind) {
  await rateLimit(`upload:${actor.id}`, 40, 3600);
  const bytes = new Uint8Array(await file.arrayBuffer());
  // xAI image input accepts JPEG/PNG only, so crop images exclude WebP
  const v = validateImageUpload(bytes, file.type || undefined, { allowWebp: kind !== "CROP_IMAGE" });
  if (!v.ok) throw invalid(v.error);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const isPublic = PUBLIC_KINDS.includes(kind);

  if (supabaseConfigured()) {
    const ext = v.mimeType.split("/")[1];
    const path = `${kind.toLowerCase()}/${actor.id}/${sha256.slice(0, 16)}-${Date.now()}.${ext}`;
    const res = await fetch(`${env.supabaseUrl}/storage/v1/object/${env.supabaseBucket}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.supabaseServiceKey}`, "Content-Type": v.mimeType, "x-upsert": "false" },
      body: bytes,
    });
    if (!res.ok) throw new AppError("File storage is unavailable. Please try again.", "UNAVAILABLE");
    return prisma.upload.create({ data: { ownerId: actor.id, kind, mimeType: v.mimeType, sizeBytes: bytes.length, sha256, storage: "SUPABASE", path, isPublic } });
  }
  return prisma.upload.create({
    data: { ownerId: actor.id, kind, mimeType: v.mimeType, sizeBytes: bytes.length, sha256, storage: "DATABASE", data: Buffer.from(bytes), isPublic },
  });
}

/** Authorise access to an upload and return its bytes. */
export async function readUpload(actor: Actor | null, id: string) {
  const up = await prisma.upload.findUnique({ where: { id } });
  if (!up) throw notFound();
  if (!up.isPublic) {
    if (!actor) throw new AppError("Sign in required.", "UNAUTHENTICATED");
    const allowed = up.ownerId === actor.id || actor.role === "ADMIN" || actor.role === "SUPER_ADMIN" || (await isProofVisibleTo(actor.id, up.id));
    if (!allowed) throw forbidden();
  }
  return { upload: up, bytes: await uploadBytes(up) };
}

export async function uploadBytes(up: { storage: string; data: Uint8Array | null; path: string | null }) {
  if (up.storage === "DATABASE") return up.data ? Buffer.from(up.data) : Buffer.alloc(0);
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/${env.supabaseBucket}/${up.path}`, {
    headers: { Authorization: `Bearer ${env.supabaseServiceKey}` },
  });
  if (!res.ok) throw new AppError("File storage is unavailable.", "UNAVAILABLE");
  return Buffer.from(await res.arrayBuffer());
}

/** Proof-of-delivery photos are visible to the order parties and requester. */
async function isProofVisibleTo(userId: string, uploadId: string) {
  const d = await prisma.delivery.findFirst({
    where: { proofUploadId: uploadId, OR: [{ requestedById: userId }, { transporterId: userId }, { order: { buyerId: userId } }, { order: { sellerId: userId } }] },
    select: { id: true },
  });
  return Boolean(d);
}
