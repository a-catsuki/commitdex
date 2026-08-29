import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  mapNormalizedPointToPreview,
} from "./photobooth-coordinates";

export { CAPTURE_SIZE } from "./photobooth-coordinates";

export type Point = {
  x: number;
  y: number;
};

export type FaceGeometry = {
  face: { x: number; y: number; width: number; height: number };
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  mouth: Point;
  angle: number;
};

export type FaceLandmarkerLike = Pick<
  FaceLandmarker,
  "detectForVideo" | "close"
>;

export type FaceLandmarkerResult = ReturnType<
  FaceLandmarkerLike["detectForVideo"]
>;

export type FaceLandmarkerSession = {
  load(): Promise<FaceLandmarkerLike>;
  detectForVideo(
    landmarker: FaceLandmarkerLike,
    video: HTMLVideoElement,
    timestamp: number,
  ): FaceLandmarkerResult | null;
  dispose(): void;
};

export const FALLBACK_FACE: FaceGeometry = {
  face: { x: 130, y: 82, width: 252, height: 310 },
  leftEye: { x: 188, y: 196 },
  rightEye: { x: 324, y: 196 },
  nose: { x: 256, y: 270 },
  mouth: { x: 256, y: 314 },
  angle: 0,
};

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarkerLike> | null = null;
let cachedLandmarker: FaceLandmarkerLike | null = null;
let activeSessions = 0;
let activeDetections = 0;
let closeWhenReady = false;

export function loadFaceLandmarker(): Promise<FaceLandmarkerLike> {
  if (!landmarkerPromise) {
    const pending = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      const options = {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      } as const;
      // The WASM runtime may emit its own XNNPACK/OpenGL diagnostics. These
      // describe delegate setup, are not application errors, and are not
      // routed through the app's error UI.
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "GPU" },
        });
      } catch {
        // WebGL is not available in every browser, VM, or privacy mode.
        return FaceLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" },
        });
      }
    })();
    const trackedPromise = pending
      .then((landmarker) => {
        cachedLandmarker = landmarker;
        if (closeWhenReady && activeSessions === 0) {
          closeWhenReady = false;
          cachedLandmarker = null;
          if (landmarkerPromise === trackedPromise) landmarkerPromise = null;
          closeLandmarkerSafely(landmarker);
        } else if (closeWhenReady) {
          closeWhenReady = false;
        }
        return landmarker;
      })
      .catch((error) => {
        // Do not clear a newer model request after the booth was reopened.
        if (landmarkerPromise === trackedPromise) {
          landmarkerPromise = null;
        }
        throw error;
      });
    landmarkerPromise = trackedPromise;
  }
  return landmarkerPromise;
}

function closeLandmarkerSafely(landmarker: FaceLandmarkerLike): void {
  try {
    landmarker.close();
  } catch {
    // Closing during browser teardown is best effort. Tracking already uses
    // CENTER MODE when the runtime is unavailable.
  }
}

function closeWhenUnused(): void {
  if (activeSessions !== 0 || activeDetections !== 0) return;

  const pending = landmarkerPromise;
  if (!pending) {
    if (cachedLandmarker) {
      const landmarker = cachedLandmarker;
      closeWhenReady = false;
      cachedLandmarker = null;
      closeLandmarkerSafely(landmarker);
    }
    return;
  }

  if (cachedLandmarker) {
    const landmarker = cachedLandmarker;
    closeWhenReady = false;
    cachedLandmarker = null;
    landmarkerPromise = null;
    closeLandmarkerSafely(landmarker);
    return;
  }

  // If creation is still pending, let its resolution close the model. A new
  // booth can acquire the same promise before then, which cancels this flag.
  closeWhenReady = true;
}

export function createFaceLandmarkerSession(): FaceLandmarkerSession {
  let disposed = false;
  activeSessions += 1;

  return {
    load() {
      if (disposed) {
        return Promise.reject(new Error("Face landmarker session disposed"));
      }
      return loadFaceLandmarker();
    },
    detectForVideo(landmarker, video, timestamp) {
      if (disposed) return null;
      activeDetections += 1;
      try {
        if (disposed) return null;
        return landmarker.detectForVideo(video, timestamp);
      } finally {
        activeDetections -= 1;
        closeWhenUnused();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      activeSessions -= 1;
      closeWhenUnused();
    },
  };
}

export function disposeFaceLandmarker(): void {
  // Kept for callers from older booth builds. Never close a model owned by a
  // live session; the reference-counted session lifecycle owns teardown.
  if (activeSessions === 0) closeWhenUnused();
}

function mapNormalizedPoint(
  point: NormalizedLandmark,
  videoWidth: number,
  videoHeight: number,
): Point {
  return mapNormalizedPointToPreview(point, videoWidth, videoHeight);
}

function averagePoint(
  landmarks: ReadonlyArray<NormalizedLandmark>,
  indices: ReadonlyArray<number>,
  videoWidth: number,
  videoHeight: number,
): Point | null {
  const points = indices
    .map((index) => landmarks[index])
    .filter((point): point is NormalizedLandmark => Boolean(point))
    .map((point) => mapNormalizedPoint(point, videoWidth, videoHeight));
  if (!points.length) return null;
  return {
    x: points.reduce((total, point) => total + point.x, 0) / points.length,
    y: points.reduce((total, point) => total + point.y, 0) / points.length,
  };
}

export function buildFaceGeometryFromLandmarks(
  landmarks: ReadonlyArray<NormalizedLandmark>,
  videoWidth: number,
  videoHeight: number,
): FaceGeometry {
  const points = landmarks.map((point) =>
    mapNormalizedPoint(point, videoWidth, videoHeight),
  );
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const face =
    points.length > 0 && maxX > minX && maxY > minY
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : FALLBACK_FACE.face;
  const fallbackLeftEye = {
    x: face.x + face.width * 0.3,
    y: face.y + face.height * 0.38,
  };
  const fallbackRightEye = {
    x: face.x + face.width * 0.7,
    y: face.y + face.height * 0.38,
  };
  const fallbackNose = {
    x: face.x + face.width / 2,
    y: face.y + face.height * 0.58,
  };
  const fallbackMouth = {
    x: face.x + face.width / 2,
    y: face.y + face.height * 0.72,
  };
  const eyes = [
    averagePoint(landmarks, [33, 133, 159, 145], videoWidth, videoHeight),
    averagePoint(landmarks, [362, 263, 386, 374], videoWidth, videoHeight),
  ]
    .filter((point): point is Point => Boolean(point))
    .sort((left, right) => left.x - right.x);
  const leftEye = eyes[0] ?? fallbackLeftEye;
  const rightEye = eyes[1] ?? fallbackRightEye;

  return {
    face,
    leftEye,
    rightEye,
    nose:
      averagePoint(landmarks, [1, 4, 6], videoWidth, videoHeight) ??
      fallbackNose,
    mouth:
      averagePoint(landmarks, [13, 14], videoWidth, videoHeight) ??
      fallbackMouth,
    angle: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
  };
}

export function smoothFaceGeometry(
  previous: FaceGeometry,
  next: FaceGeometry,
  amount = 0.32,
): FaceGeometry {
  const lerp = (from: number, to: number) => from + (to - from) * amount;
  const point = (from: Point, to: Point): Point => ({
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
  });
  return {
    face: {
      x: lerp(previous.face.x, next.face.x),
      y: lerp(previous.face.y, next.face.y),
      width: lerp(previous.face.width, next.face.width),
      height: lerp(previous.face.height, next.face.height),
    },
    leftEye: point(previous.leftEye, next.leftEye),
    rightEye: point(previous.rightEye, next.rightEye),
    nose: point(previous.nose, next.nose),
    mouth: point(previous.mouth, next.mouth),
    angle: lerp(previous.angle, next.angle),
  };
}
