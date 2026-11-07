/** File-upload validation (pure, unit-tested). Content type is detected from magic bytes, never trusted from the client. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel caps request bodies at 4.5 MB)
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a)
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  )
    return "image/webp";
  return null;
}

export type UploadValidation = { ok: true; mimeType: AllowedImageType } | { ok: false; error: string };

export function validateImageUpload(bytes: Uint8Array, declaredType?: string, opts: { maxBytes?: number; allowWebp?: boolean } = {}): UploadValidation {
  const max = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > max) return { ok: false, error: `Images must be ${Math.round(max / 1024 / 1024)} MB or smaller.` };
  const detected = sniffImageType(bytes);
  if (!detected) return { ok: false, error: "Only JPEG, PNG or WebP images are accepted." };
  if (detected === "image/webp" && opts.allowWebp === false) return { ok: false, error: "Please upload a JPEG or PNG image." };
  if (declaredType && declaredType !== detected && !(declaredType === "image/jpg" && detected === "image/jpeg")) {
    return { ok: false, error: "The file type does not match its contents." };
  }
  return { ok: true, mimeType: detected };
}
