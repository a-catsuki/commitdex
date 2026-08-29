export type WarpCenter = {
  x: number;
  y: number;
};

export type WarpRadius = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Applies a local, Gaussian-weighted radial warp.
 * Positive values expand the face, negative values compress it.
 */
export function warpImageData(
  source: ImageData,
  intensity: number,
  center: WarpCenter,
  radius: WarpRadius,
): ImageData {
  const { width, height } = source;
  if (intensity === 0) {
    return new ImageData(new Uint8ClampedArray(source.data), width, height);
  }
  const output = new ImageData(width, height);
  const strength = clamp(intensity / 100, -1, 1) * 0.72;
  const centerX = clamp(center.x, 0, width - 1);
  const centerY = clamp(center.y, 0, height - 1);
  const radiusX = Math.max(1, radius.x);
  const radiusY = Math.max(1, radius.y);

  const sample = (x: number, y: number, channel: number): number => {
    const safeX = clamp(x, 0, width - 1);
    const safeY = clamp(y, 0, height - 1);
    const x0 = Math.floor(safeX);
    const y0 = Math.floor(safeY);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const xWeight = safeX - x0;
    const yWeight = safeY - y0;
    const topLeft = source.data[(y0 * width + x0) * 4 + channel];
    const topRight = source.data[(y0 * width + x1) * 4 + channel];
    const bottomLeft = source.data[(y1 * width + x0) * 4 + channel];
    const bottomRight = source.data[(y1 * width + x1) * 4 + channel];
    const top = topLeft + (topRight - topLeft) * xWeight;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight;
    return top + (bottom - top) * yWeight;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      const normalizedX = deltaX / radiusX;
      const normalizedY = deltaY / radiusY;
      const gaussianWeight = Math.exp(
        -0.5 * (normalizedX * normalizedX + normalizedY * normalizedY),
      );
      // Inverse mapping: positive strength samples closer to the center,
      // which makes the destination pixels spread outward around the face.
      const sampleScale = 1 - strength * gaussianWeight;
      const sourceX = centerX + deltaX * sampleScale;
      const sourceY = centerY + deltaY * sampleScale;
      const offset = (y * width + x) * 4;
      output.data[offset] = clampByte(sample(sourceX, sourceY, 0));
      output.data[offset + 1] = clampByte(sample(sourceX, sourceY, 1));
      output.data[offset + 2] = clampByte(sample(sourceX, sourceY, 2));
      output.data[offset + 3] = clampByte(sample(sourceX, sourceY, 3));
    }
  }
  return output;
}

export function gaussianReadout(intensity: number): string {
  if (intensity === 0) return "NORMAL";
  return intensity < 0
    ? `−${Math.abs(intensity)} INWARD`
    : `+${intensity} OUTWARD`;
}
