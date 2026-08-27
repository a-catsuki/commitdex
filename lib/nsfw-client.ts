"use client";

type Prediction = { className: string; probability: number };

type NsfwModel = {
  classify: (
    image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    topK?: number,
  ) => Promise<Prediction[]>;
};

/** MobileNetV2 native input; keep inference tiny vs full capture frame. */
export const NSFW_SCREEN_SIZE = 224;

let modelPromise: Promise<NsfwModel> | null = null;

async function loadModel(): Promise<NsfwModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      // Dynamic import keeps TensorFlow out of the main bundle until the booth opens.
      const tf = await import("@tensorflow/tfjs");
      // WebGL is typically fastest for this CNN in-browser; fall back silently.
      try {
        await tf.setBackend("webgl");
        await tf.ready();
      } catch {
        await tf.ready();
      }
      const nsfwjs = await import("nsfwjs");
      // MobileNetV2 is the smallest built-in (vs Mid / InceptionV3).
      return nsfwjs.load("MobileNetV2") as Promise<NsfwModel>;
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

/** Warm the singleton early (booth open / idle after foil). Safe to call often. */
export function prefetchNsfwModel(): void {
  if (typeof window === "undefined") return;
  void loadModel().catch((error) => {
    console.error("[commitdex:nsfw]", error);
  });
}

/** Schedule NSFW prefetch after paint / when the browser is idle. */
export function scheduleNsfwPrefetch(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const run = () => prefetchNsfwModel();
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 400);
  return () => window.clearTimeout(id);
}

/** Block frames that look like porn / hentai / high-confidence sexy. */
export function isNsfwFlagged(predictions: Prediction[]): boolean {
  const score = (name: string) =>
    predictions.find((p) => p.className.toLowerCase() === name)?.probability ?? 0;

  if (score("porn") >= 0.55) return true;
  if (score("hentai") >= 0.55) return true;
  if (score("sexy") >= 0.75) return true;
  return false;
}

function downscaleForScreen(source: HTMLCanvasElement): HTMLCanvasElement {
  if (
    source.width === NSFW_SCREEN_SIZE &&
    source.height === NSFW_SCREEN_SIZE
  ) {
    return source;
  }
  const screen = document.createElement("canvas");
  screen.width = NSFW_SCREEN_SIZE;
  screen.height = NSFW_SCREEN_SIZE;
  const ctx = screen.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(source, 0, 0, NSFW_SCREEN_SIZE, NSFW_SCREEN_SIZE);
  return screen;
}

export async function screenCaptureForNsfw(
  source: HTMLCanvasElement,
): Promise<{ ok: true } | { ok: false; reason: "nsfw" | "model" }> {
  try {
    const model = await loadModel();
    const tiny = downscaleForScreen(source);
    const predictions = await model.classify(tiny, 5);
    if (isNsfwFlagged(predictions)) return { ok: false, reason: "nsfw" };
    return { ok: true };
  } catch (error) {
    console.error("[commitdex:nsfw]", error);
    // Fail closed: do not upload if the filter cannot run.
    return { ok: false, reason: "model" };
  }
}

export function canUseCamera(): boolean {
  if (typeof window === "undefined") return false;
  const secure =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return secure && Boolean(navigator.mediaDevices?.getUserMedia);
}
