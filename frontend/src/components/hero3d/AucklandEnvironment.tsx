"use client";
import { Environment } from "@react-three/drei";
import AucklandBackdrop from "./AucklandBackdrop";

/** The reference supplies the wet road/guardrail; invisible geometry receives car shadows. */
export default function AucklandEnvironment() {
  return <>
    <AucklandBackdrop />
    <ambientLight color="#a8bde1" intensity={0.18} />
    <hemisphereLight args={["#b4c9e6", "#63442d", 0.35]} />
    <directionalLight position={[8, 6, -7]} color="#ffc18b" intensity={1.7} />
    <directionalLight position={[-6, 5, 9]} color="#c1d9f3" intensity={0.8} />
    <rectAreaLight position={[4, 3.5, 6]} rotation={[-0.4, 0, 0]} width={9} height={0.5} color="#ffb477" intensity={2.5} />
    <Environment files="/hero3d/venice-sunset-1k.hdr" environmentIntensity={0.55}
      environmentRotation={[0, 2.4, 0]} />
  </>;
}
