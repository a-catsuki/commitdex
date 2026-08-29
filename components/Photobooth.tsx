"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/public-error";
import {
  canUseCamera,
  prefetchNsfwModel,
  screenCaptureForNsfw,
} from "@/lib/nsfw-client";
import {
  CAPTURE_SIZE,
  FALLBACK_FACE,
  buildFaceGeometryFromLandmarks,
  createFaceLandmarkerSession,
  smoothFaceGeometry,
  type FaceGeometry,
  type FaceLandmarkerSession,
  type Point,
} from "@/lib/face-tracker";
import { getSquareCrop } from "@/lib/photobooth-coordinates";
import { gaussianReadout, warpImageData } from "@/lib/photobooth-effects";

/* Hallmark · component: photobooth · genre: atmospheric · theme: Terminal
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 * motion: countdown · flash · develop · glitch-open · CRT grade (reduced-motion safe)
 */

const JPEG_QUALITY = 0.82;

type PhotoEffect =
  | "dex-cam"
  | "crt-glitch"
  | "night-shift"
  | "hotfix-heatmap"
  | "wanted"
  | "googly-ops"
  | "mustache-merge"
  | "gaussian-goof"
  | "emoji-overload";

const DEFAULT_EFFECT: PhotoEffect = "dex-cam";

function getEffectFilter(effect: PhotoEffect): string {
  if (effect === "crt-glitch") {
    return "contrast(1.1) saturate(1.3) hue-rotate(-5deg)";
  }
  if (effect === "night-shift") {
    return "contrast(1.08) saturate(0.82) brightness(0.8) sepia(0.12) hue-rotate(165deg)";
  }
  if (effect === "hotfix-heatmap") {
    return "contrast(1.16) saturate(1.55) sepia(0.25) hue-rotate(-12deg)";
  }
  if (effect === "wanted") {
    return "grayscale(1) contrast(1.65) sepia(0.42) brightness(1.02)";
  }
  if (
    effect === "googly-ops" ||
    effect === "mustache-merge" ||
    effect === "emoji-overload"
  ) {
    return "contrast(1.08) saturate(1.14)";
  }
  if (effect === "gaussian-goof") {
    return "contrast(1.08) saturate(1.16)";
  }
  return "contrast(1.06) saturate(1.08)";
}

type EffectOption = {
  id: PhotoEffect;
  label: string;
  detail: string;
};

const CORE_PHOTO_EFFECTS: ReadonlyArray<EffectOption> = [
  { id: "dex-cam", label: "DEX-CAM", detail: "clean baseline" },
  { id: "crt-glitch", label: "CRT GLITCH", detail: "RGB split" },
  { id: "night-shift", label: "NIGHT SHIFT", detail: "cool low-light" },
  { id: "hotfix-heatmap", label: "HOTFIX HEATMAP", detail: "thermal warm" },
  { id: "wanted", label: "WANTED", detail: "poster treatment" },
];

const FUN_PHOTO_EFFECTS: ReadonlyArray<EffectOption> = [
  { id: "googly-ops", label: "GOOGLY OPS", detail: "eyes have deployed" },
  { id: "mustache-merge", label: "MUSTACHE MERGE", detail: "facial hair patch" },
  { id: "gaussian-goof", label: "GAUSSIAN GOOF", detail: "wide-angle anomaly" },
  { id: "emoji-overload", label: "EMOJI OVERLOAD", detail: "sticker incident" },
];

const PHOTO_EFFECTS = [...CORE_PHOTO_EFFECTS, ...FUN_PHOTO_EFFECTS];

type TrackingStatus = "fallback" | "searching" | "tracking";

type BoothPhase =
  | "opt-in"
  | "live"
  | "countdown"
  | "developing"
  | "review"
  | "screening"
  | "saving"
  | "saved"
  | "error";

type Props = {
  username: string;
  /** Existing mugshot URL if any (dossier retake). */
  existingPhotoUrl?: string | null;
  /** Compact strip after a reel print vs dossier panel. */
  variant?: "reel" | "dossier";
  onSaved?: (photoUrl: string) => void;
  onRemoved?: () => void;
  onSkip?: () => void;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read failed"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

async function canvasToJpegDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
  });
  if (!blob) throw new Error("encode failed");
  if (blob.size > 300_000) {
    const leaner = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.65);
    });
    if (!leaner || leaner.size > 300_000) throw new Error("too large");
    return blobToDataUrl(leaner);
  }
  return blobToDataUrl(blob);
}

function drawSquareFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  filter = "none",
): void {
  const size = CAPTURE_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  const vw = video.videoWidth || size;
  const vh = video.videoHeight || size;
  const crop = getSquareCrop(vw, vh);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.filter = filter;
  ctx.drawImage(
    video,
    crop.x,
    crop.y,
    crop.side,
    crop.side,
    0,
    0,
    size,
    size,
  );
  ctx.restore();
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<number> {
  if (typeof video.requestVideoFrameCallback === "function") {
    return new Promise((resolve) => {
      video.requestVideoFrameCallback((timestamp) => resolve(timestamp));
    });
  }
  return Promise.resolve(performance.now());
}

async function drawCapturedFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<void> {
  await waitForVideoFrame(video);
  drawSquareFrame(video, canvas);
}

function applyCanvasFilter(canvas: HTMLCanvasElement, filter: string): void {
  if (filter === "none") return;
  const source = document.createElement("canvas");
  source.width = canvas.width;
  source.height = canvas.height;
  const sourceContext = source.getContext("2d");
  const context = canvas.getContext("2d");
  if (!sourceContext || !context) throw new Error("no canvas");
  sourceContext.drawImage(canvas, 0, 0);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = filter;
  context.drawImage(source, 0, 0);
  context.restore();
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}


function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
): void {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function getEyeRadius(geometry: FaceGeometry): number {
  const eyeDistance = Math.hypot(
    geometry.rightEye.x - geometry.leftEye.x,
    geometry.rightEye.y - geometry.leftEye.y,
  );
  return clamp(eyeDistance * 0.35, 24, 50);
}

function drawGooglyEyes(
  ctx: CanvasRenderingContext2D,
  geometry: FaceGeometry,
  pupilPhase: number,
): void {
  const radius = getEyeRadius(geometry);
  const pupilRadius = radius * 0.37;
  const pupilDrift = radius * 0.12;
  const drawEye = (eye: Point, pupilDirection: number) => {
    const pupilX = Math.cos(pupilPhase + pupilDirection) * pupilDrift;
    const pupilY = Math.sin(pupilPhase * 0.8 + pupilDirection) * pupilDrift;
    ctx.save();
    ctx.fillStyle = "rgba(8, 20, 16, 0.45)";
    ctx.beginPath();
    ctx.arc(eye.x + 3, eye.y + 5, radius + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(244, 247, 225, 0.98)";
    ctx.strokeStyle = "rgba(12, 25, 20, 0.98)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(18, 28, 24, 0.98)";
    ctx.beginPath();
    ctx.arc(eye.x + pupilX, eye.y + pupilY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 246, 0.95)";
    ctx.beginPath();
    ctx.arc(
      eye.x + pupilX - radius * 0.12,
      eye.y + pupilY - radius * 0.14,
      radius * 0.12,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  };

  drawEye(geometry.leftEye, -0.7);
  drawEye(geometry.rightEye, 0.5);
  ctx.save();
  ctx.strokeStyle = "rgba(12, 25, 20, 0.95)";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(
    geometry.leftEye.x - radius * 0.9,
    geometry.leftEye.y - radius * 1.25,
  );
  ctx.quadraticCurveTo(
    geometry.leftEye.x,
    geometry.leftEye.y - radius * 1.75,
    geometry.leftEye.x + radius * 0.75,
    geometry.leftEye.y - radius * 1.3,
  );
  ctx.moveTo(
    geometry.rightEye.x - radius * 0.75,
    geometry.rightEye.y - radius * 1.3,
  );
  ctx.quadraticCurveTo(
    geometry.rightEye.x,
    geometry.rightEye.y - radius * 1.75,
    geometry.rightEye.x + radius * 0.9,
    geometry.rightEye.y - radius * 1.25,
  );
  ctx.stroke();
  ctx.restore();
}

function drawMustache(
  ctx: CanvasRenderingContext2D,
  geometry: FaceGeometry,
): void {
  const scale = clamp(
    Math.hypot(
      geometry.rightEye.x - geometry.leftEye.x,
      geometry.rightEye.y - geometry.leftEye.y,
    ) / 136,
    0.72,
    1.35,
  );
  ctx.save();
  ctx.translate(geometry.mouth.x, geometry.mouth.y);
  ctx.rotate(geometry.angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(21, 24, 20, 0.96)";
  ctx.strokeStyle = "rgba(242, 231, 191, 0.72)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  const half = () => {
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.bezierCurveTo(-20, -24, -44, -31, -69, -21);
    ctx.bezierCurveTo(-91, -12, -106, -30, -111, -49);
    ctx.bezierCurveTo(-113, -12, -94, 19, -60, 27);
    ctx.bezierCurveTo(-34, 33, -12, 18, 0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  half();
  ctx.scale(-1, 1);
  half();
  ctx.restore();

  ctx.save();
  ctx.translate(geometry.nose.x, geometry.nose.y - 3);
  ctx.rotate(geometry.angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(224, 174, 128, 0.92)";
  ctx.strokeStyle = "rgba(25, 27, 21, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-11, 21);
  ctx.quadraticCurveTo(0, 30, 11, 21);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEmojiOverload(
  ctx: CanvasRenderingContext2D,
  geometry: FaceGeometry,
): void {
  const { x, y, width, height } = geometry.face;
  const scale = clamp(width / 252, 0.72, 1.3);
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(geometry.angle);
  ctx.translate(-(x + width / 2), -(y + height / 2));
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(14, 25, 20, 0.92)";
  ctx.fillStyle = "rgba(247, 211, 72, 0.98)";
  drawStar(ctx, x + width * 0.02, y + height * 0.1, 25 * scale, 10 * scale);
  ctx.fillStyle = "rgba(255, 105, 148, 0.98)";
  drawStar(ctx, x + width * 0.98, y + height * 0.16, 21 * scale, 8 * scale);
  ctx.fillStyle = "rgba(119, 218, 219, 0.98)";
  ctx.beginPath();
  const heartX = x + width * 0.05;
  const heartY = y + height * 0.92;
  ctx.moveTo(heartX, heartY);
  ctx.bezierCurveTo(heartX - 29 * scale, heartY - 34 * scale, heartX - 15 * scale, heartY - 54 * scale, heartX + 3 * scale, heartY - 43 * scale);
  ctx.bezierCurveTo(heartX + 21 * scale, heartY - 54 * scale, heartX + 35 * scale, heartY - 34 * scale, heartX + 6 * scale, heartY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 231, 116, 0.98)";
  ctx.beginPath();
  ctx.arc(x + width * 0.95, y + height * 0.9, 22 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(15, 24, 20, 0.96)";
  ctx.font = "700 27px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", x + width * 0.95, y + height * 0.9);
  ctx.font = "700 18px monospace";
  ctx.fillText("LOL", x + width * 0.12, y + height * 1.08);
  ctx.restore();
}

function drawFunnyEffectOverlay(
  canvas: HTMLCanvasElement,
  effect: PhotoEffect,
  geometry: FaceGeometry,
  pupilPhase: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  if (effect === "googly-ops") drawGooglyEyes(ctx, geometry, pupilPhase);
  if (effect === "mustache-merge") drawMustache(ctx, geometry);
  if (effect === "emoji-overload") drawEmojiOverload(ctx, geometry);
}

function applyPhotoEffect(
  canvas: HTMLCanvasElement,
  effect: PhotoEffect,
  gaussianIntensity: number,
  geometry: FaceGeometry,
  pupilPhase: number,
): void {
  if (effect === DEFAULT_EFFECT) return;
  if (effect === "gaussian-goof") {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    if (gaussianIntensity === 0) return;
    const faceCenter = {
      x: geometry.face.x + geometry.face.width / 2,
      y: geometry.face.y + geometry.face.height / 2,
    };
    const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const warped = warpImageData(source, gaussianIntensity, faceCenter, {
      x: Math.max(96, geometry.face.width * 0.85),
      y: Math.max(112, geometry.face.height * 0.62),
    });
    ctx.putImageData(warped, 0, 0);
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new Uint8ClampedArray(image.data);
  const { data, width, height } = image;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const redX = Math.min(width - 1, x + 4);
      const blueX = Math.max(0, x - 4);
      const redOffset = (y * width + redX) * 4;
      const blueOffset = (y * width + blueX) * 4;
      const sourceRed = source[offset];
      const sourceGreen = source[offset + 1];
      const sourceBlue = source[offset + 2];
      const luminance =
        sourceRed * 0.299 + sourceGreen * 0.587 + sourceBlue * 0.114;

      if (effect === "crt-glitch") {
        const scanline = y % 4 === 0 ? 0.78 : 1;
        data[offset] = clampByte(source[redOffset] * scanline);
        data[offset + 1] = clampByte(sourceGreen * scanline);
        data[offset + 2] = clampByte(source[blueOffset + 2] * scanline);
      } else if (effect === "night-shift") {
        data[offset] = clampByte(sourceRed * 0.66);
        data[offset + 1] = clampByte(sourceGreen * 0.82);
        data[offset + 2] = clampByte(sourceBlue * 1.2 + 10);
      } else if (effect === "hotfix-heatmap") {
        const heat = luminance / 255;
        if (heat < 0.34) {
          const t = heat / 0.34;
          data[offset] = clampByte(12 + t * 78);
          data[offset + 1] = clampByte(16 + t * 8);
          data[offset + 2] = clampByte(62 + t * 74);
        } else if (heat < 0.68) {
          const t = (heat - 0.34) / 0.34;
          data[offset] = clampByte(90 + t * 165);
          data[offset + 1] = clampByte(24 + t * 42);
          data[offset + 2] = clampByte(136 - t * 120);
        } else {
          const t = (heat - 0.68) / 0.32;
          data[offset] = 255;
          data[offset + 1] = clampByte(66 + t * 178);
          data[offset + 2] = clampByte(16 + t * 48);
        }
      } else if (effect === "wanted") {
        const contrast = clampByte((luminance - 112) * 1.65 + 128);
        data[offset] = clampByte(40 + contrast * 0.78);
        data[offset + 1] = clampByte(28 + contrast * 0.68);
        data[offset + 2] = clampByte(24 + contrast * 0.48);
      }
    }
  }
  ctx.putImageData(image, 0, 0);

  if (effect === "wanted") {
    ctx.save();
    ctx.strokeStyle = "rgba(242, 231, 191, 0.82)";
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.fillStyle = "rgba(242, 231, 191, 0.9)";
    ctx.font = "700 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText("WANTED", canvas.width / 2, 48);
    ctx.font = "600 13px monospace";
    ctx.fillText("DEX-CAM // HOTFIX UNIT", canvas.width / 2, canvas.height - 24);
    ctx.restore();
  }
  drawFunnyEffectOverlay(canvas, effect, geometry, pupilPhase);
}

function FunnyEffectOverlay({
  effect,
  geometry,
  pupilPhase,
}: {
  effect: PhotoEffect;
  geometry: FaceGeometry;
  pupilPhase: number;
}): ReactNode {
  if (effect === "googly-ops") {
    const radius = getEyeRadius(geometry);
    const pupilDrift = radius * 0.12;
    const pupilRadius = radius * 0.37;
    const leftPupil = {
      x: geometry.leftEye.x + Math.cos(pupilPhase - 0.7) * pupilDrift,
      y: geometry.leftEye.y + Math.sin(pupilPhase * 0.8 - 0.7) * pupilDrift,
    };
    const rightPupil = {
      x: geometry.rightEye.x + Math.cos(pupilPhase + 0.5) * pupilDrift,
      y: geometry.rightEye.y + Math.sin(pupilPhase * 0.8 + 0.5) * pupilDrift,
    };
    return (
      <svg className="photobooth__funny-svg" viewBox="0 0 512 512">
        <g fill="rgba(8, 20, 16, 0.45)">
          <circle cx={geometry.leftEye.x + 3} cy={geometry.leftEye.y + 5} r={radius + 1} />
          <circle cx={geometry.rightEye.x + 3} cy={geometry.rightEye.y + 5} r={radius + 1} />
        </g>
        <g fill="rgba(244, 247, 225, 0.98)" stroke="rgba(12, 25, 20, 0.98)" strokeWidth="5">
          <circle cx={geometry.leftEye.x} cy={geometry.leftEye.y} r={radius} />
          <circle cx={geometry.rightEye.x} cy={geometry.rightEye.y} r={radius} />
        </g>
        <g fill="rgba(18, 28, 24, 0.98)">
          <circle cx={leftPupil.x} cy={leftPupil.y} r={pupilRadius} />
          <circle cx={rightPupil.x} cy={rightPupil.y} r={pupilRadius} />
        </g>
        <g fill="rgba(255, 255, 246, 0.95)">
          <circle
            cx={leftPupil.x - radius * 0.12}
            cy={leftPupil.y - radius * 0.14}
            r={radius * 0.12}
          />
          <circle
            cx={rightPupil.x - radius * 0.12}
            cy={rightPupil.y - radius * 0.14}
            r={radius * 0.12}
          />
        </g>
        <g fill="none" stroke="rgba(12, 25, 20, 0.95)" strokeLinecap="round" strokeWidth="9">
          <path d={`M${geometry.leftEye.x - radius * 0.9} ${geometry.leftEye.y - radius * 1.25} Q${geometry.leftEye.x} ${geometry.leftEye.y - radius * 1.75} ${geometry.leftEye.x + radius * 0.75} ${geometry.leftEye.y - radius * 1.3}`} />
          <path d={`M${geometry.rightEye.x - radius * 0.75} ${geometry.rightEye.y - radius * 1.3} Q${geometry.rightEye.x} ${geometry.rightEye.y - radius * 1.75} ${geometry.rightEye.x + radius * 0.9} ${geometry.rightEye.y - radius * 1.25}`} />
        </g>
      </svg>
    );
  }
  if (effect === "mustache-merge") {
    const scale = clamp(
      Math.hypot(
        geometry.rightEye.x - geometry.leftEye.x,
        geometry.rightEye.y - geometry.leftEye.y,
      ) / 136,
      0.72,
      1.35,
    );
    return (
      <svg className="photobooth__funny-svg" viewBox="0 0 512 512">
        <g transform={`translate(${geometry.mouth.x} ${geometry.mouth.y}) rotate(${(geometry.angle * 180) / Math.PI}) scale(${scale})`} fill="rgba(21, 24, 20, 0.96)" stroke="rgba(242, 231, 191, 0.72)" strokeLinejoin="round" strokeWidth="3">
          <path d="M0 2 C-20-24-44-31-69-21 C-91-12-106-30-111-49 C-113-12-94 19-60 27 C-34 33-12 18 0 7Z" />
          <path transform="scale(-1 1)" d="M0 2 C-20-24-44-31-69-21 C-91-12-106-30-111-49 C-113-12-94 19-60 27 C-34 33-12 18 0 7Z" />
        </g>
        <path d={`M${geometry.nose.x - 11 * scale} ${geometry.nose.y - 20 * scale} L${geometry.nose.x - 11 * scale} ${geometry.nose.y + 21 * scale} Q${geometry.nose.x} ${geometry.nose.y + 30 * scale} ${geometry.nose.x + 11 * scale} ${geometry.nose.y + 21 * scale}Z`} transform={`rotate(${(geometry.angle * 180) / Math.PI} ${geometry.nose.x} ${geometry.nose.y})`} fill="rgba(224, 174, 128, 0.92)" stroke="rgba(25, 27, 21, 0.9)" strokeWidth="3" />
      </svg>
    );
  }
  if (effect === "emoji-overload") {
    const { x, y, width, height } = geometry.face;
    const scale = clamp(width / 252, 0.72, 1.3);
    const rotation = (geometry.angle * 180) / Math.PI;
    return (
      <svg className="photobooth__funny-svg" viewBox="0 0 512 512">
        <g transform={`rotate(${rotation} ${x + width / 2} ${y + height / 2})`} stroke="rgba(14, 25, 20, 0.92)" strokeWidth="3">
          <path d={`M${x + width * 0.02} ${y + height * 0.02} L${x + width * 0.02 + 6 * scale} ${y + height * 0.02 + 16 * scale} L${x + width * 0.02 + 25 * scale} ${y + height * 0.02 + 25 * scale} L${x + width * 0.02 + 6 * scale} ${y + height * 0.02 + 34 * scale} L${x + width * 0.02} ${y + height * 0.02 + 50 * scale} L${x + width * 0.02 - 6 * scale} ${y + height * 0.02 + 34 * scale} L${x - width * 0.05} ${y + height * 0.02 + 25 * scale} L${x + width * 0.02 - 6 * scale} ${y + height * 0.02 + 16 * scale}Z`} fill="rgba(247, 211, 72, 0.98)" />
          <path d={`M${x + width * 0.98} ${y + height * 0.08} L${x + width * 0.98 + 5 * scale} ${y + height * 0.08 + 14 * scale} L${x + width * 0.98 + 21 * scale} ${y + height * 0.08 + 21 * scale} L${x + width * 0.98 + 5 * scale} ${y + height * 0.08 + 28 * scale} L${x + width * 0.98} ${y + height * 0.08 + 42 * scale} L${x + width * 0.98 - 5 * scale} ${y + height * 0.08 + 28 * scale} L${x + width * 0.98 - 21 * scale} ${y + height * 0.08 + 21 * scale} L${x + width * 0.98 - 5 * scale} ${y + height * 0.08 + 14 * scale}Z`} fill="rgba(255, 105, 148, 0.98)" />
          <path d={`M${x + width * 0.05} ${y + height * 0.92} C${x + width * 0.05 - 29 * scale} ${y + height * 0.92 - 34 * scale} ${x + width * 0.05 - 15 * scale} ${y + height * 0.92 - 54 * scale} ${x + width * 0.05 + 3 * scale} ${y + height * 0.92 - 43 * scale} C${x + width * 0.05 + 21 * scale} ${y + height * 0.92 - 54 * scale} ${x + width * 0.05 + 35 * scale} ${y + height * 0.92 - 34 * scale} ${x + width * 0.05 + 6 * scale} ${y + height * 0.92}Z`} fill="rgba(119, 218, 219, 0.98)" />
          <circle cx={x + width * 0.95} cy={y + height * 0.9} r={22 * scale} fill="rgba(255, 231, 116, 0.98)" />
        </g>
        <g fill="rgba(15, 24, 20, 0.96)" fontFamily="monospace" fontWeight="700" textAnchor="middle">
          <text x={x + width * 0.95} y={y + height * 0.9 + 9} fontSize={27 * scale}>!</text>
          <text x={x + width * 0.12} y={y + height * 1.08} fontSize={18 * scale}>LOL</text>
        </g>
      </svg>
    );
  }
  return null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function handleEffectKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  effects: ReadonlyArray<EffectOption>,
  index: number,
  selectEffect: (effect: PhotoEffect) => void,
): void {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? effects.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + effects.length) %
          effects.length;
  const nextButton = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
    ".photobooth__effect",
  )[nextIndex];
  selectEffect(effects[nextIndex].id);
  nextButton?.focus();
}

export function Photobooth({
  username,
  existingPhotoUrl = null,
  variant = "reel",
  onSaved,
  onRemoved,
  onSkip,
}: Props) {
  const router = useRouter();
  const titleId = useId();
  const gaussianId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const captureLock = useRef(false);
  const faceGeometryRef = useRef<FaceGeometry>(FALLBACK_FACE);
  const trackerSessionRef = useRef<FaceLandmarkerSession | null>(null);
  const trackingGenerationRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<BoothPhase>(
    existingPhotoUrl ? "saved" : "opt-in",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingPhotoUrl);
  const [error, setError] = useState<string | undefined>();
  const [flash, setFlash] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [glitch, setGlitch] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selectedEffect, setSelectedEffect] =
    useState<PhotoEffect>(DEFAULT_EFFECT);
  const [gaussianIntensity, setGaussianIntensity] = useState(0);
  const [faceGeometry, setFaceGeometry] =
    useState<FaceGeometry>(FALLBACK_FACE);
  const [pupilPhase, setPupilPhase] = useState(0);
  const [trackingStatus, setTrackingStatus] =
    useState<TrackingStatus>("fallback");

  const stopCamera = useCallback(() => {
    trackingGenerationRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    stopCamera();
    onSkip?.();
  }, [onSkip, stopCamera]);

  useEffect(() => {
    const trackerSession = createFaceLandmarkerSession();
    trackerSessionRef.current = trackerSession;
    // Prefetch while the gate / camera warms — countdown overlaps a ready model.
    prefetchNsfwModel();
    void trackerSession.load().catch(() => undefined);
    // Defer portal mount past the effect body (avoids sync setState-in-effect lint).
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
      setReducedMotion(prefersReducedMotion());
    });
    return () => {
      window.cancelAnimationFrame(frame);
      trackerSession.dispose();
      if (trackerSessionRef.current === trackerSession) {
        trackerSessionRef.current = null;
      }
    };
  }, []);

  // Glitch flicker on open (skipped under reduced motion).
  useEffect(() => {
    if (!mounted || prefersReducedMotion()) return;
    const start = window.requestAnimationFrame(() => setGlitch(true));
    const id = window.setTimeout(() => setGlitch(false), 520);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(id);
    };
  }, [mounted]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (
      phase !== "live" &&
      phase !== "screening" &&
      phase !== "countdown"
    ) {
      return;
    }
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    void video.play().catch(() => undefined);
  }, [phase]);

  useEffect(() => {
    if (
      phase !== "live" &&
      phase !== "screening" &&
      phase !== "countdown"
    ) {
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const trackerSession = trackerSessionRef.current;
    if (!trackerSession) return;

    let disposed = false;
    let unavailable = false;
    let detecting = false;
    let lastDetection = -Infinity;
    let lastFrameTimestamp = -Infinity;
    let frameId = 0;
    const generation = trackingGenerationRef.current;
    const isActive = () =>
      !disposed &&
      generation === trackingGenerationRef.current &&
      video === videoRef.current;
    const scheduleNextFrame = () => {
      if (isActive()) frameId = window.requestAnimationFrame(detectFrame);
    };
    const statusFrame = window.requestAnimationFrame(() => {
      if (isActive()) setTrackingStatus("searching");
    });
    const detectFrame = (timestamp: number) => {
      if (!isActive()) return;
      if (timestamp <= lastFrameTimestamp) {
        scheduleNextFrame();
        return;
      }
      lastFrameTimestamp = timestamp;
      if (
        unavailable ||
        detecting ||
        timestamp - lastDetection < 80 ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        scheduleNextFrame();
        return;
      }
      detecting = true;
      lastDetection = timestamp;
      void trackerSession
        .load()
        .then((landmarker) => {
          if (
            !isActive() ||
            video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
            !video.videoWidth ||
            !video.videoHeight
          ) {
            return null;
          }
          return trackerSession.detectForVideo(landmarker, video, timestamp);
        })
        .then((result) => {
          if (!result || !isActive()) return;
          const landmarks = result.faceLandmarks[0];
          if (!landmarks?.length) {
            setTrackingStatus("searching");
            return;
          }
          const nextGeometry = buildFaceGeometryFromLandmarks(
            landmarks,
            video.videoWidth,
            video.videoHeight,
          );
          const smoothed = smoothFaceGeometry(
            faceGeometryRef.current,
            nextGeometry,
          );
          faceGeometryRef.current = smoothed;
          setFaceGeometry(smoothed);
          setTrackingStatus("tracking");
        })
        .catch(() => {
          if (isActive()) {
            unavailable = true;
            setTrackingStatus("fallback");
          }
        })
        .finally(() => {
          detecting = false;
        });
      scheduleNextFrame();
    };

    frameId = window.requestAnimationFrame(detectFrame);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(statusFrame);
      window.cancelAnimationFrame(frameId);
    };
  }, [phase]);

  // Render every live effect through the same square, mirrored pixel path as
  // capture. The source video remains mounted for MediaPipe and frame reads,
  // but is never a second visible geometry to align against.
  useEffect(() => {
    if (
      (phase !== "live" && phase !== "countdown" && phase !== "screening")
    ) {
      return;
    }
    const video = videoRef.current;
    const canvas = liveCanvasRef.current;
    if (!video || !canvas) return;
    let disposed = false;
    let lastRender = 0;
    let frameId = 0;

    const renderFrame = (timestamp: number) => {
      if (disposed) return;
      frameId = window.requestAnimationFrame(renderFrame);
      if (
        timestamp - lastRender < 80 ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        return;
      }
      lastRender = timestamp;
      drawSquareFrame(video, canvas, getEffectFilter(selectedEffect));
      applyPhotoEffect(
        canvas,
        selectedEffect,
        gaussianIntensity,
        faceGeometryRef.current,
        reducedMotion || prefersReducedMotion() ? 0 : pupilPhase,
      );
    };

    frameId = window.requestAnimationFrame(renderFrame);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [
    gaussianIntensity,
    phase,
    pupilPhase,
    reducedMotion,
    selectedEffect,
  ]);

  useEffect(() => {
    if (
      selectedEffect !== "googly-ops" ||
      reducedMotion ||
      prefersReducedMotion()
    ) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setPupilPhase((current) => current + 0.35);
    }, 160);
    return () => window.clearInterval(intervalId);
  }, [reducedMotion, selectedEffect]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [dismiss]);

  async function startCamera() {
    setError(undefined);
    setSelectedEffect(DEFAULT_EFFECT);
    setGaussianIntensity(0);
    faceGeometryRef.current = FALLBACK_FACE;
    setFaceGeometry(FALLBACK_FACE);
    setTrackingStatus("fallback");
    prefetchNsfwModel();
    if (!canUseCamera()) {
      setPhase("error");
      setError(COPY.insecureOrigin);
      return;
    }
    // Keep the booth-open model session alive while replacing an older stream.
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
      });
      streamRef.current = stream;
      setPhase("live");
    } catch {
      stopCamera();
      setPhase("error");
      setError(COPY.cameraDenied);
    }
  }

  async function runCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      setPhase("live");
      setError("Camera is still warming up. Wait a beat, then shutter.");
      return;
    }

    const skipMotion = prefersReducedMotion();
    setFlash(true);
    window.setTimeout(() => setFlash(false), skipMotion ? 80 : 220);

    try {
      // Freeze the presented video frame before screening and effects.
      await drawCapturedFrame(video, canvas);
      // Freeze the latest smoothed landmarks after the same frame is drawn.
      // Do not run a second detection here: it can describe a different frame.
      const captureGeometry = faceGeometryRef.current;
      setPhase("screening");
      setError(undefined);
      const screen = await screenCaptureForNsfw(canvas);
      if (!screen.ok) {
        setPhase("live");
        setError(
          screen.reason === "nsfw"
            ? COPY.photoRejected
            : "Dex filter warm-up failed. Try again in a second.",
        );
        return;
      }
      // Screen the untouched camera frame first, then render the chosen effect.
      applyCanvasFilter(canvas, getEffectFilter(selectedEffect));
      applyPhotoEffect(
        canvas,
        selectedEffect,
        gaussianIntensity,
        captureGeometry,
        skipMotion || reducedMotion ? 0 : pupilPhase,
      );
      const dataUrl = await canvasToJpegDataUrl(canvas);
      setPreviewUrl(dataUrl);
      stopCamera();

      if (skipMotion) {
        setPhase("review");
      } else {
        setPhase("developing");
        await wait(1100);
        setPhase("review");
      }
    } catch {
      setPhase("live");
      setError(COPY.photoTooLarge);
    } finally {
      captureLock.current = false;
      setCount(null);
    }
  }

  async function shutter() {
    if (phase !== "live" || captureLock.current) return;
    captureLock.current = true;
    setError(undefined);
    prefetchNsfwModel();

    if (prefersReducedMotion()) {
      setPhase("countdown");
      setCount(null);
      await runCapture();
      return;
    }

    setPhase("countdown");
    for (const n of [3, 2, 1]) {
      setCount(n);
      await wait(700);
      if (!streamRef.current) {
        captureLock.current = false;
        setCount(null);
        setPhase("live");
        return;
      }
    }
    setCount(null);
    await runCapture();
  }

  async function accept() {
    if (!previewUrl || !previewUrl.startsWith("data:")) return;
    setPhase("saving");
    setError(undefined);
    try {
      const response = await fetch("/api/trainer/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          image: previewUrl,
          mime: "image/jpeg",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        photo_url?: string;
      };
      if (!response.ok) {
        setPhase("review");
        setError(
          typeof payload.error === "string" && payload.error
            ? payload.error
            : COPY.photoOffline,
        );
        return;
      }
      const url =
        payload.photo_url ??
        `/api/trainer/photo/${encodeURIComponent(username)}?t=${Date.now()}`;
      setPreviewUrl(url);
      setPhase("saved");
      onSaved?.(url);
      if (variant === "dossier") router.refresh();
    } catch {
      setPhase("review");
      setError(COPY.photoOffline);
    }
  }

  async function removePhoto() {
    setPhase("saving");
    setError(undefined);
    try {
      const response = await fetch("/api/trainer/photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setPhase("saved");
        setError(
          typeof payload.error === "string" && payload.error
            ? payload.error
            : COPY.photoOffline,
        );
        return;
      }
      setPreviewUrl(null);
      setPhase("opt-in");
      onRemoved?.();
      if (variant === "dossier") router.refresh();
    } catch {
      setPhase("saved");
      setError(COPY.photoOffline);
    }
  }

  async function retake() {
    setPreviewUrl(null);
    setError(undefined);
    setCount(null);
    captureLock.current = false;
    await startCamera();
  }

  const busy =
    phase === "screening" ||
    phase === "saving" ||
    phase === "countdown" ||
    phase === "developing";
  const showVideo =
    phase === "live" || phase === "screening" || phase === "countdown";
  const showStill =
    (phase === "review" ||
      phase === "saved" ||
      phase === "saving" ||
      phase === "developing") &&
    Boolean(previewUrl);

  const bezelRight =
    phase === "countdown"
      ? count != null
        ? String(count)
        : "…"
      : busy
        ? phase === "developing"
          ? "DEV"
          : "SCAN"
        : phase === "live"
          ? "LIVE"
          : "HOLD";
  const activeEffect =
    PHOTO_EFFECTS.find((effect) => effect.id === selectedEffect) ??
    PHOTO_EFFECTS[0];
  const motionReduced = reducedMotion || prefersReducedMotion();
  const canvasPreview = showVideo;

  if (!mounted) return null;

  return createPortal(
    <div
      className="photobooth-overlay"
      data-variant={variant}
      data-glitch={glitch ? "true" : undefined}
      data-reduced={motionReduced ? "true" : undefined}
    >
      <button
        type="button"
        className="photobooth-overlay__backdrop"
        aria-label="Close photobooth"
        onClick={() => {
          if (!busy) dismiss();
        }}
      />
      <div
        ref={dialogRef}
        className="photobooth"
        data-variant={variant}
        data-phase={phase}
        data-glitch={glitch ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="photobooth__head">
          <div className="photobooth__head-row">
            <p className="photobooth__kicker">DEX-CAM · mugshot bay</p>
            <button
              ref={closeRef}
              type="button"
              className="photobooth__close"
              onClick={dismiss}
              disabled={busy}
              aria-label="Close photobooth"
            >
              close
            </button>
          </div>
          <h3 className="photobooth__title" id={titleId}>
            {existingPhotoUrl && phase === "saved"
              ? "Trainer mugshot on file"
              : "Optional photobooth"}
          </h3>
          <p className="photobooth__lede">
            Snap a CRT mugshot for the dossier. Skip anytime. Camera stays off
            until you allow it.
          </p>
        </header>

        {phase === "opt-in" ? (
          <div className="photobooth__gate">
            <p className="photobooth__gate-copy">
              Webcam only on HTTPS or localhost. Frames are screened before
              save. Face landmarks stay in memory for lens placement only.
            </p>
            <div className="photobooth__actions">
              <button
                type="button"
                className="btn"
                onClick={() => void startCamera()}
                data-state="idle"
              >
                allow camera
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={dismiss}
                data-state="idle"
              >
                skip booth
              </button>
            </div>
          </div>
        ) : null}

        {phase !== "opt-in" ? (
          <div
            className="photobooth__crt"
            data-flash={flash ? "true" : undefined}
            data-phase={phase}
            data-effect={selectedEffect}
          >
            <div className="photobooth__chrome" aria-hidden="true">
              <span className="photobooth__badge">DEX-CAM</span>
              <span className="photobooth__badge photobooth__badge--dim">
                WANTED UNIT
              </span>
            </div>
            <div className="photobooth__bezel" aria-hidden="true">
              <span>REC</span>
              <span data-live={phase === "live" ? "true" : undefined}>
                {bezelRight}
              </span>
            </div>
            <div className="photobooth__viewport">
              <video
                ref={videoRef}
                className="photobooth__video"
                playsInline
                muted
                autoPlay
                hidden={!showVideo}
                data-effect={selectedEffect}
                style={canvasPreview ? { visibility: "hidden" } : undefined}
              />
              <canvas
                ref={liveCanvasRef}
                className="photobooth__live-canvas"
                hidden={!canvasPreview}
                data-effect={selectedEffect}
                aria-hidden="true"
              />
              {showStill && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="photobooth__still"
                  src={previewUrl}
                  alt=""
                  width={CAPTURE_SIZE}
                  height={CAPTURE_SIZE}
                  data-developing={
                    phase === "developing" ? "true" : undefined
                  }
                  data-effect={selectedEffect}
                />
              ) : null}
              {!showVideo && !showStill ? (
                <div className="photobooth__blank" aria-hidden="true">
                  <span>NO SIGNAL</span>
                </div>
              ) : null}
              <span className="photobooth__crt-grade" aria-hidden="true" />
              <span className="photobooth__scan" aria-hidden="true" />
              {!canvasPreview ? (
                <span
                  className="photobooth__effect-overlay"
                  data-effect={selectedEffect}
                  aria-hidden="true"
                >
                  <FunnyEffectOverlay
                    effect={selectedEffect}
                    geometry={faceGeometry}
                    pupilPhase={motionReduced ? 0 : pupilPhase}
                  />
                </span>
              ) : null}
              {showVideo ? (
                <svg
                  className="photobooth__tracking-hud"
                  viewBox="0 0 512 512"
                  aria-hidden="true"
                  data-tracking={trackingStatus}
                >
                  <rect
                    className="photobooth__tracking-box"
                    x={faceGeometry.face.x}
                    y={faceGeometry.face.y}
                    width={faceGeometry.face.width}
                    height={faceGeometry.face.height}
                    rx={Math.min(faceGeometry.face.width, faceGeometry.face.height) * 0.12}
                  />
                  {trackingStatus === "tracking" ? (
                    <>
                      <circle className="photobooth__landmark-dot" cx={faceGeometry.leftEye.x} cy={faceGeometry.leftEye.y} r="4" />
                      <circle className="photobooth__landmark-dot" cx={faceGeometry.rightEye.x} cy={faceGeometry.rightEye.y} r="4" />
                      <circle className="photobooth__landmark-dot" cx={faceGeometry.nose.x} cy={faceGeometry.nose.y} r="3" />
                      <path
                        className="photobooth__tracking-line"
                        d={`M${faceGeometry.leftEye.x} ${faceGeometry.leftEye.y} L${faceGeometry.nose.x} ${faceGeometry.nose.y} L${faceGeometry.rightEye.x} ${faceGeometry.rightEye.y}`}
                      />
                    </>
                  ) : null}
                </svg>
              ) : null}
              {count != null ? (
                <span className="photobooth__countdown" aria-live="polite">
                  {count}
                </span>
              ) : null}
              {phase === "developing" ? (
                <div className="photobooth__develop" aria-live="polite">
                  <span className="photobooth__develop-strip" />
                  <span className="photobooth__develop-label">developing…</span>
                </div>
              ) : null}
            </div>
            <canvas ref={canvasRef} className="photobooth__canvas" hidden />
            <div className="photobooth__rails" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

        {phase === "live" || phase === "countdown" || phase === "screening" ? (
          <fieldset
            className="photobooth__effects"
            disabled={busy}
            aria-label="Choose a photobooth effect"
          >
            <legend className="photobooth__effects-legend">
              <span>visual patch</span>
              <span>{activeEffect.detail}</span>
            </legend>
            <div className="photobooth__effect-row">
              <span className="photobooth__effect-row-label">LOOK</span>
              <div
                className="photobooth__effect-list"
                role="radiogroup"
                aria-label="Look effects"
              >
              {CORE_PHOTO_EFFECTS.map((effect, index) => (
                <button
                  key={effect.id}
                  type="button"
                  className="photobooth__effect"
                  data-selected={selectedEffect === effect.id}
                  aria-checked={selectedEffect === effect.id}
                  aria-label={`${effect.label}: ${effect.detail}`}
                  role="radio"
                  onClick={() => setSelectedEffect(effect.id)}
                  onKeyDown={(event) =>
                    handleEffectKeyDown(
                      event,
                      CORE_PHOTO_EFFECTS,
                      index,
                      setSelectedEffect,
                    )
                  }
                >
                  {effect.label}
                </button>
              ))}
              </div>
            </div>
            <div className="photobooth__effect-row photobooth__effect-row--goof">
              <span className="photobooth__effect-row-label">GOOF</span>
              <div
                className="photobooth__effect-list"
                role="radiogroup"
                aria-label="Goofy effects"
              >
              {FUN_PHOTO_EFFECTS.map((effect, index) => (
                <button
                  key={effect.id}
                  type="button"
                  className="photobooth__effect"
                  data-selected={selectedEffect === effect.id}
                  aria-checked={selectedEffect === effect.id}
                  aria-label={`${effect.label}: ${effect.detail}`}
                  role="radio"
                  onClick={() => setSelectedEffect(effect.id)}
                  onKeyDown={(event) =>
                    handleEffectKeyDown(
                      event,
                      FUN_PHOTO_EFFECTS,
                      index,
                      setSelectedEffect,
                    )
                  }
                >
                  {effect.label}
                </button>
              ))}
              </div>
            </div>
            {selectedEffect === "gaussian-goof" ? (
              <div className="photobooth__gaussian-control">
                <div className="photobooth__gaussian-head">
                  <label htmlFor={gaussianId}>
                    Gaussian direction
                  </label>
                  <output htmlFor={gaussianId}>
                    {gaussianReadout(gaussianIntensity)}
                  </output>
                </div>
                <input
                  id={gaussianId}
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={gaussianIntensity}
                  onChange={(event) =>
                    setGaussianIntensity(Number(event.target.value))
                  }
                  aria-label="Gaussian Goof direction and intensity"
                  aria-valuetext={
                    gaussianReadout(gaussianIntensity)
                  }
                />
                <div className="photobooth__gaussian-scale" aria-hidden="true">
                  <span>INWARD</span>
                  <span>← NORMAL →</span>
                  <span>OUTWARD</span>
                </div>
              </div>
            ) : null}
            <p className="photobooth__tracking-note" aria-live="polite">
              {trackingStatus === "tracking"
                ? "FACE LOCK // landmarks live"
                : trackingStatus === "searching"
                  ? "FACE LOCK // scanning"
                  : "CENTER MODE // tracker unavailable"}
            </p>
          </fieldset>
        ) : null}

        {phase === "live" ? (
          <div className="photobooth__actions">
            <button
              type="button"
              className="btn photobooth__shutter"
              onClick={() => void shutter()}
              disabled={busy}
              aria-busy={busy}
              data-state="idle"
            >
              shutter
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={dismiss}
              disabled={busy}
            >
              cancel
            </button>
          </div>
        ) : null}

        {phase === "countdown" || phase === "screening" ? (
          <p
            className="photobooth__status"
            data-state="loading"
            aria-live="polite"
          >
            {phase === "countdown" ? "hold still…" : "scan…"}
          </p>
        ) : null}

        {phase === "developing" ? (
          <p
            className="photobooth__status"
            data-state="loading"
            aria-live="polite"
          >
            print strip developing…
          </p>
        ) : null}

        {phase === "review" ? (
          <>
            <p className="photobooth__effect-note" aria-live="polite">
              capture locked with <strong>{activeEffect.label}</strong>
            </p>
            <div className="photobooth__actions">
              <button
                type="button"
                className="btn"
                onClick={() => void accept()}
                data-state="idle"
              >
                accept mugshot
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void retake()}
                data-state="idle"
              >
                retake
              </button>
            </div>
          </>
        ) : null}

        {phase === "saving" ? (
          <p
            className="photobooth__status"
            data-state="loading"
            aria-live="polite"
          >
            filing mugshot…
          </p>
        ) : null}

        {phase === "saved" && previewUrl ? (
          <div className="photobooth__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void retake()}
              data-state="success"
            >
              retake
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void removePhoto()}
              data-state="idle"
            >
              remove photo
            </button>
            <button
              type="button"
              className="btn"
              onClick={dismiss}
              data-state="success"
            >
              done
            </button>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="photobooth__actions">
            <p className="prompt__error" role="alert">
              {error ?? COPY.cameraDenied}
            </p>
            <button type="button" className="btn btn--ghost" onClick={dismiss}>
              skip booth
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void startCamera()}
              data-state="error"
            >
              try again
            </button>
          </div>
        ) : null}

        {error && phase !== "error" ? (
          <p className="prompt__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
