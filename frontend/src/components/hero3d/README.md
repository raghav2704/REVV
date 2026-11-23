# REVV real-time BMW hero

The live scene uses bmw-m4-csl.glb (Black Snow, CC BY 4.0), the existing dusk
reference clean plate, and the local Poly Haven CC0 sunset HDR for lighting.
It is an actual perspective-rendered 3D model, not the previous image slide.

Wheel groups rotate by travelled distance divided by tyre radius. Calipers stay
with the chassis. A small braking dip affects the sprung body only. A shallow
curve changes the vehicle perspective while approaching and departing; the
camera stays fixed throughout scrolling. Geometry is decoded to floating point
before transformation and batched by material. The source floor is measured
from precise transformed vertex bounds. Contact shadows travel under all four
tyres, with a broader ambient shadow and faint wet-road reflection.

CameraController fits the vehicle envelope and projects the near front tyre onto
the reference road coordinate. Desktop and portrait mobile have separate road
anchors so the car remains visible and does not sit on the guardrail/verge.

One reversible GSAP ScrollTrigger controls the sequence: 4–45% arrival,
45–65% parked hold, 65–90% exit. REVV fades in at 32–46%, out at 67–79%.
Canvas renders on demand only. DPR is capped at 1 with hardware antialiasing.
No refractive transmission, postprocessing or shadow-map render passes are used.
The 64x64 contact shadow is a procedural alpha texture. The mirrored model uses
simple unlit materials. Hidden/offscreen scenes do not invalidate continuously.
Reduced motion, Still view, WebGL failure and loading timeout use the static
reference composition. The marketplace and data are unchanged.

Full model/source/legal credits: public/hero3d/ATTRIBUTION.txt.
