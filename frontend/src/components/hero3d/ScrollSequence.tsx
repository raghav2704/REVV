"use client";
/* Imperative animation refs and DOM styles are intentionally updated outside React renders. */
/* eslint-disable react-hooks/immutability */
import { useEffect, type RefObject, type MutableRefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { chapter, CHAPTERS, logoVisibility, smooth } from "./sequence";

type Props = {
  root: RefObject<HTMLElement | null>;
  progress: MutableRefObject<number>;
  invalidateRef: MutableRefObject<(() => void) | null>;
  active: boolean;
};
export default function ScrollSequence({ root, progress, invalidateRef, active }: Props) {
  useEffect(() => {
    const element = root.current;
    if (!element || !active) return;
    gsap.registerPlugin(ScrollTrigger);
    const copy = element.querySelector<HTMLElement>("[data-hero-copy]")!;
    const caption = element.querySelector<HTMLElement>("[data-hero-chapter]")!;
    const nav = document.querySelector<HTMLElement>("body > header");
    let visible = true;
    const update = (p: number) => {
      progress.current = p;
      element.style.setProperty("--hero-reveal", String(logoVisibility(p)));
      element.style.setProperty("--hero-intro", String(1 - smooth(0.22, 0.39, p)));
      element.style.setProperty("--hero-shift", `${(1 - smooth(0.39, 0.53, p)) * 24}px`);
      element.style.setProperty("--hero-exit", String(smooth(0.92, 1, p)));
      element.style.setProperty("--hero-progress", String(p));
      element.dataset.progress = p.toFixed(4);
      copy.inert = logoVisibility(p) < 0.35;
      caption.textContent = CHAPTERS[chapter(p)];
      element.dataset.logo = logoVisibility(p).toFixed(4);
      if (visible && !document.hidden) invalidateRef.current?.();
    };
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: () => `top ${nav?.getBoundingClientRect().height ?? 74}px`,
      end: "bottom bottom", scrub: true,
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => update(self.progress),
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) invalidateRef.current?.();
    });
    observer.observe(element);
    const resize = new ResizeObserver(() => {
      element.style.setProperty("--revv-nav-height", `${nav?.getBoundingClientRect().height ?? 74}px`);
      ScrollTrigger.refresh();
    });
    if (nav) resize.observe(nav);
    const resume = () => { if (!document.hidden && visible) invalidateRef.current?.(); };
    document.addEventListener("visibilitychange", resume);
    update(trigger.progress);
    return () => {
      trigger.kill(); observer.disconnect(); resize.disconnect();
      document.removeEventListener("visibilitychange", resume);
      copy.inert = false;
    };
  }, [active, root, progress, invalidateRef]);
  return null;
}
