import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  clearTrainerPhoto,
  getTrainer,
  setTrainerPhoto,
  trainerPhotoSrc,
} from "@/lib/db";
import { sessionMatchesTrainer } from "@/lib/github-auth";
import { COPY, jsonError, jsonFromError } from "@/lib/public-error";
import {
  clearStoredPhotoFiles,
  decodePhotoData,
  isAllowedPhotoMime,
  persistPhotoBytes,
  PHOTO_MAX_BYTES,
  type PhotoMime,
} from "@/lib/photo-store";
import { clientKey, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function requireMatchingGithub(username: string) {
  const session = await auth();
  const login = session?.login;
  if (!login) {
    return jsonError(401, COPY.photoUnauthorized);
  }
  if (!sessionMatchesTrainer(login, username)) {
    return jsonError(403, COPY.photoWrongAccount);
  }
  return null;
}

type Body = {
  username?: string;
  /** data:image/jpeg;base64,... or raw base64 */
  image?: string;
  mime?: string;
};

function parseUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(handle)) return null;
  return handle;
}

function decodeUpload(image: string, mimeHint?: string): { bytes: Buffer; mime: PhotoMime } | null {
  const decoded = decodePhotoData(image, mimeHint ?? null);
  if (!decoded) return null;
  if (decoded.bytes.byteLength > PHOTO_MAX_BYTES) return null;
  // Soft magic-byte check
  const b0 = decoded.bytes[0];
  const b1 = decoded.bytes[1];
  const isJpeg = b0 === 0xff && b1 === 0xd8;
  const isWebp =
    decoded.bytes.byteLength >= 12 &&
    decoded.bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    decoded.bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (decoded.mime === "image/jpeg" && !isJpeg) return null;
  if (decoded.mime === "image/webp" && !isWebp) return null;
  if (!isJpeg && !isWebp) return null;
  return { bytes: decoded.bytes, mime: isWebp ? "image/webp" : "image/jpeg" };
}

export async function POST(request: Request) {
  if (rateLimited(`photo:${clientKey(request)}`, 8)) {
    return jsonError(429, COPY.tooManyPhotos);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, COPY.badJson);
  }

  const username = parseUsername(body.username);
  if (!username) return jsonError(400, COPY.badUsername);

  const denied = await requireMatchingGithub(username);
  if (denied) return denied;

  if (typeof body.image !== "string" || !body.image.trim()) {
    return jsonError(400, COPY.photoBadType);
  }
  if (body.mime && !isAllowedPhotoMime(body.mime)) {
    return jsonError(400, COPY.photoBadType);
  }

  const decoded = decodeUpload(body.image, body.mime);
  if (!decoded) {
    return jsonError(400, COPY.photoTooLarge);
  }

  try {
    const trainer = await getTrainer(username);
    if (!trainer) return jsonError(404, COPY.scanFirst);
    if (!trainer.featured_card) return jsonError(400, COPY.noFoilForPhoto);

    await clearStoredPhotoFiles(username, trainer.photo_url);
    const stored = await persistPhotoBytes(username, decoded.bytes, decoded.mime);
    const saved = await setTrainerPhoto(username, {
      photo_url: stored.photo_url,
      photo_data: stored.photo_data,
      mime: stored.mime,
    });

    return NextResponse.json({
      ok: true,
      photo_url: trainerPhotoSrc(saved),
      photo_updated_at: saved.photo_updated_at,
    });
  } catch (error) {
    return jsonFromError(error, "trainer");
  }
}

export async function DELETE(request: Request) {
  if (rateLimited(`photo-del:${clientKey(request)}`, 12)) {
    return jsonError(429, COPY.tooManyPhotos);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, COPY.badJson);
  }

  const username = parseUsername(body.username);
  if (!username) return jsonError(400, COPY.badUsername);

  const denied = await requireMatchingGithub(username);
  if (denied) return denied;

  try {
    const trainer = await getTrainer(username);
    if (!trainer) return jsonError(404, COPY.scanFirst);
    await clearStoredPhotoFiles(username, trainer.photo_url);
    await clearTrainerPhoto(username);
    return NextResponse.json({ ok: true, photo_url: null });
  } catch (error) {
    return jsonFromError(error, "trainer");
  }
}
