"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/public-error";
import {
  canUseCamera,
  prefetchNsfwModel,
  screenCaptureForNsfw,
} from "@/lib/nsfw-client";

/* Hallmark · component: photobooth · genre: atmospheric · theme: Terminal
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 * motion: countdown · flash · develop · glitch-open · CRT grade (reduced-motion safe)
 */

const CAPTURE_SIZE = 512;
const JPEG_QUALITY = 0.82;

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
): void {
  const size = CAPTURE_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  const vw = video.videoWidth || size;
  const vh = video.videoHeight || size;
  const side = Math.min(vw, vh);
  const sx = (vw - side) / 2;
  const sy = (vh - side) / 2;
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const captureLock = useRef(false);

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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const dismiss = useCallback(() => {
    stopCamera();
    onSkip?.();
  }, [onSkip, stopCamera]);

  useEffect(() => {
    // Prefetch while the gate / camera warms — countdown overlaps a ready model.
    prefetchNsfwModel();
    // Defer portal mount past the effect body (avoids sync setState-in-effect lint).
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
      setReducedMotion(prefersReducedMotion());
    });
    return () => window.cancelAnimationFrame(frame);
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
    prefetchNsfwModel();
    if (!canUseCamera()) {
      setPhase("error");
      setError(COPY.insecureOrigin);
      return;
    }
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
      drawSquareFrame(video, canvas);
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

  if (!mounted) return null;

  return createPortal(
    <div
      className="photobooth-overlay"
      data-variant={variant}
      data-glitch={glitch ? "true" : undefined}
      data-reduced={reducedMotion ? "true" : undefined}
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
              save.
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
                />
              ) : null}
              {!showVideo && !showStill ? (
                <div className="photobooth__blank" aria-hidden="true">
                  <span>NO SIGNAL</span>
                </div>
              ) : null}
              <span className="photobooth__crt-grade" aria-hidden="true" />
              <span className="photobooth__scan" aria-hidden="true" />
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
