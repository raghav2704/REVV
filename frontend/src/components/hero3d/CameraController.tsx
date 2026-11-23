"use client";
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { PARKED_X, VEHICLE_SCALE } from "./sequence";

/** Project the near front tyre onto the same road pixel at every viewport size. */
export default function CameraController() {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const mobile = size.width < 760;
    const scale = Math.max(size.width / 1672, size.height / 941);
    const planeWidth = 1672 * scale, planeHeight = 941 * scale;
    const cropX = (size.width - planeWidth) * (mobile ? 0.42 : 0.5);
    const cropY = (size.height - planeHeight) * 0.5;
    const desiredWidth = planeWidth * (mobile ? 0.31 : 0.295);
    const anchorX = cropX + planeWidth * (mobile ? 0.42 : 0.775);
    const anchorY = cropY + planeHeight * (mobile ? 0.85 : 0.785);
    const target = new Vector3(PARKED_X, 0.7 * VEHICLE_SCALE, 0);
    const direction = new Vector3(-0.67, 0.13, 0.74).normalize();
    let distance = 20;
    camera.clearViewOffset();
    camera.fov = 34;
    camera.updateProjectionMatrix();
    // Fit a fixed physical envelope, not a zoom animation. Scene stays still.
    for (let step = 0; step < 3; step++) {
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target); camera.updateMatrixWorld(true);
      const points = [];
      for (const x of [-2.4, 2.4]) for (const y of [0, 1.5]) for (const z of [-1, 1]) {
        points.push(new Vector3(PARKED_X + x * VEHICLE_SCALE, y * VEHICLE_SCALE, z * VEHICLE_SCALE).project(camera).x);
      }
      const width = (Math.max(...points) - Math.min(...points)) * size.width / 2;
      distance *= width / desiredWidth;
    }
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target); camera.updateMatrixWorld(true);
    const foot = new Vector3(PARKED_X - 1.284 * VEHICLE_SCALE, 0, 0.738 * VEHICLE_SCALE).project(camera);
    const projectedX = (foot.x + 1) * size.width / 2;
    const projectedY = (1 - foot.y) * size.height / 2;
    camera.setViewOffset(size.width, size.height, projectedX - anchorX, projectedY - anchorY, size.width, size.height);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}
