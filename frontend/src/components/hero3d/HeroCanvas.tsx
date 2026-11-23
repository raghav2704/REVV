"use client";
import { Suspense, useEffect, type MutableRefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import AucklandEnvironment from "./AucklandEnvironment";
import Vehicle3D from "./Vehicle3D";
import CameraController from "./CameraController";

type Props = {
  progress: MutableRefObject<number>;
  invalidateRef: MutableRefObject<(() => void) | null>;
  onReady: () => void;
  onFailure: () => void;
};
function Ready({ invalidateRef, onReady, onFailure }: Pick<Props, "invalidateRef" | "onReady" | "onFailure">) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    invalidateRef.current = invalidate;
    gl.domElement.addEventListener("webglcontextlost", onFailure);
    onReady(); invalidate();
    return () => {
      invalidateRef.current = null;
      gl.domElement.removeEventListener("webglcontextlost", onFailure);
    };
  }, [invalidate, invalidateRef, onReady, onFailure, gl]);
  return null;
}
export default function HeroCanvas({ progress, invalidateRef, onReady, onFailure }: Props) {
  return <Canvas frameloop="demand" dpr={1}
    camera={{ position: [-6, 3.5, 14], fov: 38, near: 0.1, far: 240 }}
    gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    onCreated={({ gl }) => {
      gl.setClearColor("#182337");
      gl.domElement.setAttribute("aria-label", "Reference dusk skyline and wet road with a three-dimensional animated BMW M4 CSL");
    }}
    fallback={null}>
    <Suspense fallback={null}>
      <AucklandEnvironment />
      <Vehicle3D progress={progress} />
      <CameraController />
      <Ready invalidateRef={invalidateRef} onReady={onReady} onFailure={onFailure} />
    </Suspense>
  </Canvas>;
}
