"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, Float32BufferAttribute, BufferGeometry, Group, Material, Mesh, MeshPhysicalMaterial, MeshBasicMaterial, DataTexture, RGBAFormat, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { smooth, VEHICLE_SCALE, vehicleX } from "./sequence";

/** Batch the BMW M4 CSL source parts by material, retaining four independently rotating wheels. */
function prepareVehicle(source: Group) {
  source.updateMatrixWorld(true);
  const floor = new Box3().setFromObject(source, true).min.y;
  const body = new Group();
  const chassis = new Group(); chassis.name = "chassis"; body.add(chassis);
  const wheels = Array.from({ length: 4 }, () => new Group());
  const centers = [new Vector3(-1.284, 0.361 - floor, 0.738), new Vector3(-1.284, 0.361 - floor, -0.735),
    new Vector3(1.414, 0.361 - floor, 0.738), new Vector3(1.414, 0.361 - floor, -0.735)];
  const buckets = Array.from({ length: 5 }, () => new Map<Material, BufferGeometry[]>());
  const materials = new Map<Material, Material>();
  source.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    const original = object.material as MeshPhysicalMaterial;
    let material = materials.get(original);
    if (!material) {
      const copy = original.name === "M4xNME_Paint"
        ? new MeshPhysicalMaterial({ color: "#222b35", metalness: 0.65, roughness: 0.24,
          clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 0.85 })
        : original.name === "M4xNME_GlassClear"
          ? new MeshPhysicalMaterial({ color: "#7794a9", metalness: 0, roughness: 0.055,
            transmission: 0, thickness: 0, ior: 1.45, envMapIntensity: 0.5, transparent: true, opacity: 1 })
          : original.clone();
      copy.name = original.name;
      // Reflective tinted windows retain depth without a second refraction pass.
      if (/GlassClear/.test(copy.name)) {
        copy.color.set("#182936"); copy.metalness = 0.3; copy.roughness = 0.12;
        copy.transparent = false; copy.opacity = 1;
      }
      copy.transmission = 0; copy.transmissionMap = null;
      if (/Paint2/.test(copy.name)) { copy.color.set("#151c26"); copy.metalness = 0.6; copy.roughness = 0.3; }
      if (/silver|chrome/i.test(copy.name)) { copy.color.set("#76808b"); copy.metalness = 0.85; copy.roughness = 0.22; }
      if (/runningY|highbeam/i.test(copy.name)) { copy.emissive.set("#d7eaff"); copy.emissiveIntensity = 3; }
      if (/taillight_top|fogred/i.test(copy.name)) { copy.emissive.set("#b71719"); copy.emissiveIntensity = 1.4; }
      material = copy; materials.set(original, copy);
    }
    const geometry = object.geometry.clone();
    // Decode quantized attributes before applying world transforms; integer buffers
    // would otherwise clamp transformed vertices and distort the vehicle.
    for (const name of ["position", "normal", "uv"]) {
      const attribute = geometry.getAttribute(name);
      if (!attribute) continue;
      const values = new Float32Array(attribute.count * attribute.itemSize);
      for (let vertex = 0; vertex < attribute.count; vertex++) {
        for (let axis = 0; axis < attribute.itemSize; axis++) {
          values[vertex * attribute.itemSize + axis] = attribute.getComponent(vertex, axis);
        }
      }
      geometry.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize));
    }
    geometry.applyMatrix4(object.matrixWorld);
    // Source is Y-up, nose +Z; align it with the existing road's -X model axis.
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(0, -floor, 0);
    let bucket = 0;
    if (/wheels_enkeif|Object_4\.|brakedisc.*(brake|misc)/i.test(object.name)) {
      const center = new Box3().setFromBufferAttribute(geometry.getAttribute("position")).getCenter(new Vector3());
      bucket = 1 + (center.x > 0 ? 2 : 0) + (center.z < 0 ? 1 : 0);
      geometry.translate(-centers[bucket - 1].x, -centers[bucket - 1].y, -centers[bucket - 1].z);
    }
    const group = buckets[bucket];
    if (!group.has(material)) group.set(material, []);
    group.get(material)!.push(geometry);
  });
  const geometries: BufferGeometry[] = [];
  buckets.forEach((bucket, i) => {
    const target = i === 0 ? chassis : wheels[i - 1];
    bucket.forEach((parts, material) => {
      // All source parts use position/normal/UV. Remove unused tangents to merge consistently.
      for (const part of parts) {
        for (const attribute of Object.keys(part.attributes)) {
          if (!["position", "normal", "uv"].includes(attribute)) part.deleteAttribute(attribute);
        }
        if (!part.getAttribute("normal")) part.computeVertexNormals();
        if (!part.getAttribute("uv")) part.setAttribute("uv", new Float32BufferAttribute(new Float32Array(part.getAttribute("position").count * 2), 2));

      }
      const merged = mergeGeometries(parts, false);
      if (merged) {
        const mesh = new Mesh(merged, material);
        mesh.castShadow = true; mesh.receiveShadow = true;
        target.add(mesh); geometries.push(merged);
      }
      parts.forEach((part) => part.dispose());
    });
  });
  wheels.forEach((wheel, i) => { wheel.name = `wheel-${i}`; wheel.position.copy(centers[i]); body.add(wheel); });
  return { body, chassis, wheels, centers, geometries, materials: [...materials.values()] };
}

export default function Vehicle3D({ progress }: { progress: MutableRefObject<number> }) {
  const { scene } = useGLTF("/hero3d/bmw-m4-csl.glb", false, true);
  const model = useMemo(() => prepareVehicle(scene), [scene]);
  const group = useRef<Group>(null);
  const contact = useMemo(() => {
    const size = 64;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      pixels[(y * size + x) * 4 + 3] = Math.round(Math.max(0, 1 - radius) ** 1.4 * 220);
    }
    const texture = new DataTexture(pixels, size, size, RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }, []);
  // A faint mirrored model gives the wet reference road a moving car reflection.
  const reflection = useMemo(() => {
    const body = model.body.clone(true);
    const materials = new Map<Material, Material>();
    body.traverse((object) => {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
      const original = object.material;
      if (!/M4xNME_Paint(?:2)?$|Scene_-_Root/.test(original.name)) {
        object.visible = false;
        return;
      }
      if (!materials.has(original)) {
        const copy = new MeshBasicMaterial({ color: "#081320", transparent: true, opacity: 0.065, depthWrite: false });
        materials.set(original, copy);
      }
      object.material = materials.get(original)!;
      object.castShadow = false; object.receiveShadow = false;
    });
    return { body, materials: [...materials.values()] };
  }, [model]);
  useEffect(() => () => {
    contact.dispose();
    model.geometries.forEach((geometry) => geometry.dispose());
    model.materials.forEach((material) => material.dispose());
    reflection.materials.forEach((material) => material.dispose());
  }, [model, reflection, contact]);
  useFrame(() => {
    const p = progress.current;
    const x = vehicleX(p);
    // Mild brake dive and rebound affect only the sprung body; tyres stay on the road.
    const braking = smooth(0.29, 0.39, p) * (1 - smooth(0.405, 0.47, p));
    const departure = smooth(0.65, 0.72, p) * (1 - smooth(0.78, 0.86, p));
    model.chassis.rotation.z = braking * 0.012 - departure * 0.007;
    model.chassis.position.y = -braking * 0.009;
    const reflectedChassis = reflection.body.getObjectByName("chassis");
    if (reflectedChassis) {
      reflectedChassis.rotation.z = model.chassis.rotation.z;
      reflectedChassis.position.y = model.chassis.position.y;
    }
    if (group.current) {
      group.current.position.x = x;
      // A shallow road curve introduces actual changing perspective, not a
      // screen-space slide. The stopped pose is exactly aligned to the plate.
      const entry = 1 - smooth(0.12, 0.45, p);
      const exit = smooth(0.65, 0.9, p);
      group.current.position.z = -entry * 0.4 + exit * 0.5;
      group.current.rotation.y = entry * 0.025 + exit * 0.02;
    }
    // Distance / tyre radius: wheel motion reverses exactly when the scroll does.
    const angle = (28 - x) / (0.348 * VEHICLE_SCALE);
    model.wheels.forEach((wheel, i) => {
      wheel.rotation.z = angle;
      const mirrored = reflection.body.getObjectByName(`wheel-${i}`);
      if (mirrored) mirrored.rotation.z = angle;
    });
  });
  return <group ref={group} position={[28, 0.002, 0]} scale={VEHICLE_SCALE}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
      <planeGeometry args={[5.2, 2.4]} />
      <meshBasicMaterial color="#000000" map={contact} transparent opacity={0.65} depthWrite={false} />
    </mesh>
    {model.centers.map((center, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0.004, center.z]}>
      <planeGeometry args={[0.85, 0.45]} />
      <meshBasicMaterial color="#000000" map={contact} transparent opacity={0.95} depthWrite={false} />
    </mesh>)}
    <primitive object={model.body} dispose={null} />
    <group scale={[1, -1, 1]} position={[0, -0.04, 0]}>
      <primitive object={reflection.body} dispose={null} />
    </group>
  </group>;
}
