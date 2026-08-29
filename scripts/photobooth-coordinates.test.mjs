import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTURE_SIZE,
  getSquareCrop,
  mapNormalizedPointToPreview,
} from "../lib/photobooth-coordinates.ts";

test("synthetic left eye stays aligned in the mirrored preview space", () => {
  const sourceLeftEye = { x: 0.25, y: 0.42 };
  const previewPoint = mapNormalizedPointToPreview(
    sourceLeftEye,
    640,
    480,
  );

  assert.ok(Math.abs(previewPoint.x - 426.6666666666667) < 0.000001);
  assert.equal(previewPoint.y, 215.04);
  assert.ok(previewPoint.x > CAPTURE_SIZE / 2);
  assert.ok(previewPoint.y > 0 && previewPoint.y < CAPTURE_SIZE);
});

test("center and edge landmarks honor the cover crop without double mirroring", () => {
  assert.deepEqual(
    mapNormalizedPointToPreview({ x: 0.5, y: 0.5 }, 640, 480),
    { x: 256, y: 256 },
  );
  assert.deepEqual(
    mapNormalizedPointToPreview({ x: 0.125, y: 0.5 }, 640, 480),
    { x: 512, y: 256 },
  );
  assert.deepEqual(
    mapNormalizedPointToPreview({ x: 0.875, y: 0.5 }, 640, 480),
    { x: 0, y: 256 },
  );
});

test("center cover crop produces a non-empty square output", () => {
  const crop = getSquareCrop(640, 480);

  assert.deepEqual(crop, { x: 80, y: 0, side: 480 });
  assert.ok(crop.side > 0);
});

test("synthetic landmarks place anchors in visible mirrored coordinates", () => {
  const landmarks = {
    leftEye: { x: 0.75, y: 0.4 },
    rightEye: { x: 0.25, y: 0.4 },
    nose: { x: 0.5, y: 0.55 },
    mouth: { x: 0.5, y: 0.7 },
  };

  assert.deepEqual(
    mapNormalizedPointToPreview(landmarks.leftEye, 640, 480),
    { x: 85.33333333333331, y: 204.8 },
  );
  assert.deepEqual(
    mapNormalizedPointToPreview(landmarks.rightEye, 640, 480),
    { x: 426.6666666666667, y: 204.8 },
  );
  assert.deepEqual(
    mapNormalizedPointToPreview(landmarks.nose, 640, 480),
    { x: 256, y: 281.6 },
  );
  assert.deepEqual(
    mapNormalizedPointToPreview(landmarks.mouth, 640, 480),
    { x: 256, y: 358.4 },
  );
});
