"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ScrollSequence from "./ScrollSequence";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

type Props = { vehicleCount: number | null; locationCount: number | null };
export default function Revv3DHero({ vehicleCount, locationCount }: Props) {
  const root = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const invalidateRef = useRef<(() => void) | null>(null);
  const [mode, setMode] = useState<"loading" | "ready" | "static">("loading");
  const [mountScene, setMountScene] = useState(false);
  const ready = useCallback(() => setMode("ready"), []);
  const failure = useCallback(() => { setMode("static"); setMountScene(false); }, []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const setup = () => {
      if (disposed) return;
      clearTimeout(timer);
      if (preference.matches) { failure(); return; }
      const probe = document.createElement("canvas");
      const context = probe.getContext("webgl2");
      if (!context) { failure(); return; }
      context.getExtension("WEBGL_lose_context")?.loseContext();
      setMode("loading"); setMountScene(true);
      // Failed downloads or a stalled graphics driver must never leave an empty, long hero.
      timer = setTimeout(() => {
        if (root.current?.dataset.mode !== "ready") failure();
      }, 12000);
    };
    const frame = requestAnimationFrame(setup);
    preference.addEventListener("change", setup);
    return () => { disposed = true; cancelAnimationFrame(frame); clearTimeout(timer); preference.removeEventListener("change", setup); };
  }, [failure]);

  return <section ref={root} className="revv3d" data-mode={mode} aria-label="REVV — Auckland after hours">
    <div className="revv3d-stage">
      <div className="revv3d-fallback" aria-hidden="true" />
      {mountScene && <div className="revv3d-canvas" aria-hidden="true">
        <SceneBoundary onFailure={failure}>
          <HeroCanvas progress={progress} invalidateRef={invalidateRef} onReady={ready} onFailure={failure} />
        </SceneBoundary>
      </div>}
      <div className="revv3d-shade" aria-hidden="true" />
      <div className="revv3d-topline">
        <span><i /> AUCKLAND, NEW ZEALAND <span className="revv3d-coordinate">36.8485° S · 174.7633° E</span></span>
        <div className="revv3d-controls">
          {mode === "ready" && <button type="button" onClick={failure}>Still view</button>}
          <a href="#explore">Skip to vehicles <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div className="revv3d-intro" aria-hidden="true">
        <p className="revv3d-eyebrow">A CITY THAT NEVER STANDS STILL.</p>
        <p className="revv3d-intro-title">Neither<br />should you.</p>
        <p className="revv3d-intro-note">A new perspective on your next drive.</p>
      </div>
      <div className="revv3d-copy" data-hero-copy inert={mode === "loading"}>
        <p className="revv3d-eyebrow">A NEW ERA OF AUTOMOTIVE</p>
        <h1 aria-label="REVV">REV<span>V</span></h1>
        <h2>Drive Smarter.<br /><span>Buy Better.</span></h2>
        <p className="revv3d-description">The next generation of buying, selling and managing vehicles in New Zealand.</p>
        <div className="revv3d-actions">
          <a className="revv3d-primary" href="#explore">Explore Vehicles <span aria-hidden="true">↗</span></a>
          <Link className="revv3d-secondary" href="/sell">Sell Your Vehicle</Link>
        </div>
      </div>
      <div className="revv3d-bottom">
        <div className="revv3d-stats" aria-label="Marketplace statistics">
          <div><strong>{vehicleCount === null ? "—" : vehicleCount.toLocaleString("en-NZ")}</strong><span>Vehicles listed</span></div>
          <div><strong>{locationCount === null ? "—" : locationCount.toLocaleString("en-NZ")}</strong><span>NZ locations</span></div>
          <div><strong className="revv3d-nz">REVV</strong><span>Built in NZ</span></div>
        </div>
        <div className="revv3d-scroll" aria-hidden="true"><span data-hero-chapter>The city</span><b /><span>SCROLL TO DRIVE ↓</span></div>
      </div>
      <p className="revv3d-development">In development. Current listings are demonstration and testing data.</p>
      <div className="revv3d-transition" aria-hidden="true" />
      <a className="revv3d-credit" href="/hero3d/ATTRIBUTION.txt" target="_blank" rel="noreferrer">Scene credits ↗</a>
    </div>
    <ScrollSequence root={root} progress={progress} invalidateRef={invalidateRef} active={mode === "ready"} />
  </section>;
}
