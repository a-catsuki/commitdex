import { NextResponse } from "next/server";
import { getTrainer } from "@/lib/db";
import { COPY, jsonError, jsonFromError } from "@/lib/public-error";
import { decodePhotoData, readLocalPhotoFile } from "@/lib/photo-store";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ username: string }>;
};

function parseUsername(raw: string): string | null {
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(handle)) return null;
  return handle;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { username: raw } = await params;
  const username = parseUsername(raw);
  if (!username) return jsonError(400, COPY.badUsername);

  try {
    const trainer = await getTrainer(username);
    if (!trainer) return jsonError(404, COPY.trainerNotFound);

    // Absolute R2 (or other CDN) URLs are already public; redirect so <img> works.
    if (trainer.photo_url && /^https?:\/\//i.test(trainer.photo_url)) {
      return NextResponse.redirect(trainer.photo_url, 302);
    }

    if (trainer.photo_data) {
      const decoded = decodePhotoData(trainer.photo_data);
      if (!decoded) return jsonError(404, COPY.trainerNotFound);
      return new NextResponse(new Uint8Array(decoded.bytes), {
        status: 200,
        headers: {
          "Content-Type": decoded.mime,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const local = readLocalPhotoFile(username);
    if (local) {
      return new NextResponse(new Uint8Array(local.bytes), {
        status: 200,
        headers: {
          "Content-Type": local.mime,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return jsonError(404, COPY.trainerNotFound);
  } catch (error) {
    return jsonFromError(error, "trainer");
  }
}
