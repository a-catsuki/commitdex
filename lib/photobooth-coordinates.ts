export const CAPTURE_SIZE = 512;

export type CoordinatePoint = {
  x: number;
  y: number;
};

export type SquareCrop = {
  side: number;
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The booth viewport is a centered square `object-fit: cover` frame.
 * Keep this crop definition shared by the video preview and canvas capture.
 */
export function getSquareCrop(
  videoWidth: number,
  videoHeight: number,
): SquareCrop {
  const width = Math.max(1, videoWidth);
  const height = Math.max(1, videoHeight);
  const side = Math.min(width, height);
  return {
    side,
    x: (width - side) / 2,
    y: (height - side) / 2,
  };
}

/**
 * Maps source-video coordinates into the selfie-oriented visible preview.
 * The preview and captured canvas intentionally share this exact space.
 */
export function mapSourcePointToPreview(
  point: CoordinatePoint,
  videoWidth: number,
  videoHeight: number,
  outputSize = CAPTURE_SIZE,
): CoordinatePoint {
  const crop = getSquareCrop(videoWidth, videoHeight);
  return {
    x: clamp(
      outputSize - ((point.x - crop.x) / crop.side) * outputSize,
      0,
      outputSize,
    ),
    y: clamp(
      ((point.y - crop.y) / crop.side) * outputSize,
      0,
      outputSize,
    ),
  };
}

export function mapNormalizedPointToPreview(
  point: CoordinatePoint,
  videoWidth: number,
  videoHeight: number,
  outputSize = CAPTURE_SIZE,
): CoordinatePoint {
  return mapSourcePointToPreview(
    {
      x: clamp(point.x, 0, 1) * Math.max(1, videoWidth),
      y: clamp(point.y, 0, 1) * Math.max(1, videoHeight),
    },
    videoWidth,
    videoHeight,
    outputSize,
  );
}
