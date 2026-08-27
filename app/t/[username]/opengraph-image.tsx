import { ImageResponse } from "next/og";
import { getTrainer } from "@/lib/db";
import { TYPE_META } from "@/lib/type-meta";
import { isCreatureType } from "@/lib/types";

export const runtime = "nodejs";
export const alt = "Commitdex trainer card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const trainer = await getTrainer(username).catch(() => null);
  const title = trainer?.persona_title ?? "not on file";
  const handle = trainer?.github_username ?? username.toLowerCase();
  const type = trainer && isCreatureType(trainer.dominant_type) ? trainer.dominant_type : "chaotic";
  const typeLabel = TYPE_META[type].label;
  const chaos = trainer?.chaos ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0d1c12",
          color: "#7dff9a",
          padding: 64,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", opacity: 0.7 }}>
          MOST WANTED · COMMITDEX
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 28, opacity: 0.8 }}>@{handle}</div>
          <div style={{ fontSize: 64, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}>
          <span>{typeLabel} type</span>
          <span>chaos {chaos}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
