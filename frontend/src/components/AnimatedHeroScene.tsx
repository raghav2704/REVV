
export default function AnimatedHeroScene() {
  return (
    <div className="revv-hero-scene" aria-hidden="true">
      <div className="revv-hero-backdrop" />

      {/* Car enters, stops briefly, then exits */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/revv-car-cutout.png"
        alt=""
        className="revv-hero-car"
        draggable={false}
        decoding="async"
      />
    </div>
  );
}
