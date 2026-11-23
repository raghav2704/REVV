"use client";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { SRGBColorSpace } from "three";

/** Reference-matched dusk plate. Camera and skyline stay fixed during the drive. */
export default function AucklandBackdrop() {
  const source = useTexture("/hero3d/reference-dusk-plate.webp");
  const texture = useMemo(() => {
    const copy = source.clone();
    copy.colorSpace = SRGBColorSpace;
    copy.needsUpdate = true;
    return copy;
  }, [source]);
  const { size } = useThree();
  useLayoutEffect(() => {
    const imageAspect = 1672 / 941;
    const aspect = size.width / size.height;
    const width = Math.min(1, aspect / imageAspect);
    const height = Math.min(1, imageAspect / aspect);
    // Preserve the full reference on desktop; retain the skyline in a portrait crop.
    texture.repeat.set(width, height);
    texture.offset.set((1 - width) * (size.width < 760 ? 0.42 : 0.5), (1 - height) * 0.5);
  }, [texture, size.width, size.height]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive attach="background" object={texture} />;
}
