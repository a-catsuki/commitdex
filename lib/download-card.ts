export async function downloadCardPng(node: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  await document.fonts.ready;
  await waitForBrowser();
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

type OpeningFrame = {
  side: "back" | "front";
  scaleX: number;
  rotate: number;
  opacity: number;
  delay: number;
};

const GIF_WIDTH = 360;
const GIF_HEIGHT = 504;

function waitForBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

async function waitForStage(root: HTMLDivElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
  await waitForBrowser();
  const { width, height } = root.getBoundingClientRect();
  if (width < 1 || height < 1) {
    throw new Error("The card export stage could not be laid out.");
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The card image could not be prepared."));
    image.src = dataUrl;
  });
}

function safeFilename(filename: string): string {
  const stem = filename
    .replace(/\.[a-z\d]+$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  return `${stem || "commitdex-opening"}.gif`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type ExportStage = {
  host: HTMLDivElement;
  root: HTMLDivElement;
  back: HTMLDivElement;
  front: HTMLDivElement;
};

function freezeAnimations(root: HTMLElement) {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>("*"))];
  for (const element of elements) {
    element.style.setProperty("animation", "none", "important");
    element.style.setProperty("transition", "none", "important");
  }
}

function getOpaqueBackground(): string {
  const rootStyle = getComputedStyle(document.documentElement);
  const paper = rootStyle.getPropertyValue("--color-paper").trim();
  const fallback = "#0d1d17";
  const candidates = [paper, getComputedStyle(document.body).backgroundColor, fallback];
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.width = "1px";
  probe.style.height = "1px";
  document.body.append(probe);

  try {
    for (const candidate of candidates) {
      probe.style.backgroundColor = candidate;
      if (probe.style.backgroundColor && probe.style.backgroundColor !== "transparent") {
        return candidate;
      }
    }
  } finally {
    probe.remove();
  }

  return fallback;
}

function createExportStage(node: HTMLElement): ExportStage {
  const background = getOpaqueBackground();
  const host = document.createElement("div");
  const root = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "1px";
  host.style.height = "1px";
  host.style.overflow = "hidden";
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";

  root.setAttribute("aria-hidden", "true");
  root.style.position = "relative";
  root.style.left = "0";
  root.style.top = "0";
  root.style.width = `${GIF_WIDTH}px`;
  root.style.height = `${GIF_HEIGHT}px`;
  root.style.boxSizing = "border-box";
  root.style.overflow = "hidden";
  root.style.backgroundColor = background;
  root.style.pointerEvents = "none";
  root.style.zIndex = "0";

  const scene = document.createElement("div");
  scene.style.position = "relative";
  scene.style.width = "100%";
  scene.style.height = "100%";
  scene.style.overflow = "visible";

  const sourceBack = node.closest(".card-pack")?.querySelector<HTMLElement>(".card-pack__face--back");
  const back = sourceBack
    ? (sourceBack.cloneNode(true) as HTMLDivElement)
    : document.createElement("div");
  if (!sourceBack) {
    back.className = "card-pack__face card-pack__face--back";
    const foil = document.createElement("span");
    foil.className = "card-pack__foil";
    foil.textContent = "unidentified specimen";
    back.append(foil);
  }

  const card = node.cloneNode(true) as HTMLElement;
  card.style.width = "100%";
  card.style.height = "100%";
  card.style.maxWidth = "none";
  card.style.minHeight = "0";
  card.style.boxSizing = "border-box";
  card.style.opacity = "1";
  card.style.transform = "none";

  const front = document.createElement("div");
  front.className = "card-pack__face card-pack__face--front";
  front.append(card);

  for (const face of [back, front]) {
    face.style.position = "absolute";
    face.style.inset = "0";
    face.style.display = "grid";
    face.style.placeItems = "center";
    face.style.backfaceVisibility = "visible";
    face.style.transform = "none";
    face.style.transformOrigin = "center";
  }

  freezeAnimations(back);
  freezeAnimations(front);
  scene.append(back, front);
  root.append(scene);
  host.append(root);
  document.body.append(host);

  return { host, root, back, front };
}

function applyOpeningFrame(stage: ExportStage, frame: OpeningFrame) {
  const active = frame.side === "back" ? stage.back : stage.front;
  const inactive = frame.side === "back" ? stage.front : stage.back;
  inactive.style.visibility = "hidden";
  inactive.style.opacity = "0";
  active.style.visibility = "visible";
  active.style.opacity = String(frame.opacity);
  active.style.transform = `translateZ(0) translate(-50%, -50%) rotate(${frame.rotate}rad) scaleX(${frame.scaleX})`;
  active.style.left = "50%";
  active.style.top = "50%";
  active.style.right = "auto";
  active.style.bottom = "auto";
  active.style.width = "100%";
  active.style.height = "100%";
  active.style.filter = "drop-shadow(0 0.5rem 0.8rem rgba(0, 0, 0, 0.42))";
}

async function captureStage(
  root: HTMLDivElement,
  background: string,
  toPng: typeof import("html-to-image")["toPng"],
): Promise<Uint8Array> {
  await waitForStage(root);
  await waitForBrowser();
  const dataUrl = await toPng(root, {
    width: GIF_WIDTH,
    height: GIF_HEIGHT,
    canvasWidth: GIF_WIDTH,
    canvasHeight: GIF_HEIGHT,
    pixelRatio: 1,
    cacheBust: true,
    style: {
      position: "relative",
      left: "0",
      top: "0",
      transform: "none",
    },
  });
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = GIF_WIDTH;
  canvas.height = GIF_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("GIF export is not supported in this browser.");

  context.clearRect(0, 0, GIF_WIDTH, GIF_HEIGHT);
  context.drawImage(image, 0, 0, GIF_WIDTH, GIF_HEIGHT);
  const capturedPixels = context.getImageData(0, 0, GIF_WIDTH, GIF_HEIGHT).data;
  const hasVisiblePixels = capturedPixels.some(
    (value, index) => index % 4 !== 3 && value > 8,
  );
  if (!hasVisiblePixels) {
    throw new Error("The card image was blank and could not be exported.");
  }

  context.fillStyle = background;
  context.fillRect(0, 0, GIF_WIDTH, GIF_HEIGHT);
  context.drawImage(image, 0, 0, GIF_WIDTH, GIF_HEIGHT);
  return new Uint8Array(context.getImageData(0, 0, GIF_WIDTH, GIF_HEIGHT).data);
}

export async function downloadCardGif(
  node: HTMLElement,
  filename: string,
  reduced = false,
) {
  if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") {
    throw new Error("GIF export is not supported in this browser.");
  }

  const [{ toPng }, { GIFEncoder, applyPalette, quantize }] = await Promise.all([
    import("html-to-image"),
    import("gifenc"),
  ]);
  await document.fonts.ready;
  const stage = createExportStage(node);
  const background = getComputedStyle(stage.root).backgroundColor || "#0d1d17";

  const frames: OpeningFrame[] = reduced
    ? [
        { side: "front", scaleX: 0.98, rotate: -0.01, opacity: 1, delay: 100 },
        { side: "front", scaleX: 1, rotate: 0, opacity: 1, delay: 450 },
      ]
    : [
        { side: "back", scaleX: 0.94, rotate: -0.1, opacity: 0.96, delay: 160 },
        { side: "back", scaleX: 0.72, rotate: -0.075, opacity: 1, delay: 110 },
        { side: "back", scaleX: 0.38, rotate: -0.035, opacity: 1, delay: 90 },
        { side: "back", scaleX: 0.08, rotate: 0, opacity: 0.92, delay: 70 },
        { side: "front", scaleX: 0.08, rotate: 0, opacity: 0.92, delay: 70 },
        { side: "front", scaleX: 0.36, rotate: 0.025, opacity: 1, delay: 90 },
        { side: "front", scaleX: 0.72, rotate: 0.045, opacity: 1, delay: 120 },
        { side: "front", scaleX: 1, rotate: 0, opacity: 1, delay: 520 },
      ];

  try {
    const pixels: Uint8Array[] = [];
    for (const frame of frames) {
      applyOpeningFrame(stage, frame);
      pixels.push(await captureStage(stage.root, background, toPng));
      await waitForBrowser();
    }

    const allPixels = new Uint8Array(pixels.length * GIF_WIDTH * GIF_HEIGHT * 4);
    pixels.forEach((framePixels, index) => {
      allPixels.set(framePixels, index * framePixels.length);
    });

    const palette = quantize(allPixels, 256, { format: "rgb444" });
    const gif = GIFEncoder();
    frames.forEach((frame, index) => {
      const indexed = applyPalette(pixels[index], palette, "rgb444");
      gif.writeFrame(indexed, GIF_WIDTH, GIF_HEIGHT, {
        palette: index === 0 ? palette : undefined,
        delay: frame.delay,
        dispose: 2,
        ...(index === 0 ? { repeat: 0 } : {}),
      });
    });
    gif.finish();
    const bytes = gif.bytes();
    const blobBytes = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(blobBytes).set(bytes);
    triggerBlobDownload(new Blob([blobBytes], { type: "image/gif" }), safeFilename(filename));
  } finally {
    stage.host.remove();
  }
}
