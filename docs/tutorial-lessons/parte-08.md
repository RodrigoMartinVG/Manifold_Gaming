# Parte 8. El dibujo: the lesson sheets

The design each of part 8's seventeen lessons is written from, under the approved
[curriculum](../tutorial-curriculum.md) (§5, part 8) and [decision 0021](../decisions/0021-a-new-tutorial.md).
_Real-Time Rendering_, 4th ed. (**RTR**), and Lengyel's _Foundations_ vol. 2 (**L2**) lead: the proofs come from L2
(re-signed for WebGL's clip space), the figures, numbers and traps from RTR. The renderer is three.js 0.187: every claim
about its API below was checked against the repository's `node_modules/three`. The readers' notes were matched by
subject. Abbreviations as in the curriculum §2.

## The part sheet

**At the end, the reader can** follow a coin from its model matrix to its pixels and find which stage costs the frame;
write vertex and fragment shaders; derive the depth row and choose near and far; draw transparency in an order that is
right and say why; derive Lambert and Blinn–Phong from light with units; keep colour linear and encode it once, after
tone mapping; texture with mipmaps and anisotropy; build a tangent frame for a normal map; use PBR materials with light
from the environment; cast shadows with a fitted frustum and a bias they can reason about; cull with the frustum's
planes and a BVH; draw a thousand coins in one call; make particles, billboards, fog and bloom. And make the drawing
show exactly what the simulation knows.

**The closing game (8.17, _la sala de noche_).** 6.16's stealth room at night, with 7.14's guard. Goal: collect the 60
coins and reach the exit within 3 minutes. You lose when the guard catches you in _chase_, or when a watcher sees you
for a whole second (the alarm sends every guard). The tools are the light itself: ceiling spot lamps cast shadows, and
you hide in shadows you can see, because the drawn shadow is the logic's "who sees whom" (agreement measured, 8.13);
a lamp can be broken (6.11), with sparks and glass from a pool, and the meter drops; a fog bank attenuates light and
sight by the same law, drawn with the logic's transmittance; the guard carries a lantern, a moving shadow-casting spot
whose cone is its sight cone (RTR: a view cone is a spotlight in reverse), so you see where it looks. Coins are instanced
and glow (8.7's shader, with bloom). Score: time, coins, times seen; the ghost of your best run comes back (2.15). It
exercises every lesson of the part, and the frame bar (3.13) stays under 16.7 ms on an integrated GPU.

**How the code evolves.** The drawing is the pilot's `view.ts` (`createView`) and modules beside it. None of it enters
the hash; every console variable it adds is of the view kind (decision 0010).

| Lesson | Modules (public names)                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8.7    | `createView` gains `toneMapping` and `exposure`; `lamps.ts` (`drawLamps`); part 6's `light.ts` gains `falloff(d2, range)` and `spotFactor(cos, cosOuter, cosInner)`, shared with the drawing; `glow.ts` (`glowMaterial`) |
| 8.13   | `materials.ts` (`materialFor(kind)`); `environment.ts` (`setEnvironment`); `shadows.ts` (`enableShadows`, `fitShadow`, `normalBiasFor`); `drawLamps` grows `castShadow`                                                  |
| 8.17   | `instances.ts` (`InstanceSet`); `cull.ts` (`frustumPlanes`, `sphereOutside`); `particles.ts` (`ParticlePool`, on 4.14's pool); `fog.ts` (`withLogicFog`); `post.ts` (`createPost`); `view.quality`                       |

The renderer is `WebGLRenderer` with GLSL in `ShaderMaterial` (Spector.js captures it, WebGL2 Fundamentals explains it,
its clip space is [−1, 1]³). `WebGPURenderer` with TSL is named in 8.2's "En los motores".

**Lab-kit pieces the part adds** (curriculum §4.2): the pipeline strip, also a badge on every lesson; a toy rasterizer
on a coarse pixel grid; a GLSL sandbox (vertex and fragment editors, compile errors by line, uniform sliders); a curve
plot with tick marks at representable values; draggable transparent quads; a light-falloff plotter; a tone-curve
plotter; a zoomed texel grid; a receding checkerboard with a filter menu and mip levels as colours; a sampled-signal
plotter; a TBN drawer; a sphere grid by roughness and metalness; a shadow-map viewer; a frustum top view; a
`renderer.info` panel beside 3.13's frame bar; a linear readback probe (a float target read at one pixel, to compare the
drawing with the logic).

**Threads.** The drawing is outside the hash (§6.1), and L2's precision engineering is its face (8.3, 8.12). "El mismo
movimiento" returns in the reflection vector (8.5) and the tangent frame (8.10). Planes return in 8.14. Strange worlds
are seeded: textures as charts (8.8), the handedness sign (8.10), mirrors with det < 0 (8.12), portals (8.14).

---

### 8.1 El camino de la placa de video (C)

- **Question:** ¿Qué pasa entre un triángulo y un píxel, y dónde se va el tiempo?
- **Before:** 1.11 (spaces), 3.1 (meshes, winding), 3.13 (the frame budget). The reader has `renderer.render` in the
  project since 1.3 and a frame bar whose "draw" block is opaque.
- **Leads:** RTR 2 (application, geometry processing, rasterization, pixel processing; what a stage does against how a
  GPU does it; the walkthrough), 3.1–3.3, 18.2 (the bottleneck). **Also:** L2 §5.5 (guard band, 2×2 quads, the order of
  per-pixel tests, one big triangle for a full-screen pass); G2 §11.1, §11.4.1–3 (four framings; from algorithm to
  pipeline); GPP ch. 8 (double buffering and tearing); WebGL2 Fundamentals; Spector.js.
- **Approach:** of G2's four framings, take "visibility plus lighting" as the map of the part (8.3–8.4 visibility, 8.5–8.12
  light). RTR's stage strip becomes the badge. Hook: follow one coin from its model matrix to its pixels (RTR 2.6's
  walkthrough, with our numbers); then shrink the canvas and watch whether the frame gets faster.
- **The mathematics:** the chain **M**, **V** = camera⁻¹ (= [**R**ᵀ \| −**R**ᵀ**t**], L1), **P**; clipping in clip space
  (−*w* ≤ _x_, _y_, _z_ ≤ _w_), the division by _w_ (1.10), the viewport _x_px_ = (_x_ndc_ + 1)/2 · _W_, pixel centres at +0.5.
  Rasterization: edge functions _E_ab_(_P_) = ORIENT2D(_A_, _B_, _P_) (1.6), positive inside a CCW triangle; the top-left
  rule for ties; barycentrics = _E_/(2·area) (3.6); quads of 2×2 for derivatives, so small triangles shade helper pixels.
  Perspective-correct interpolation is stated here and proved in 8.3. Cost: a pipeline runs at its slowest stage (a
  model: the bottleneck can move within a frame, RTR 18.2); vary one stage's load to find it. **Example:** NDC
  (0.25, −0.5) in 800 × 600 lands at (500, 450) from the top left, a pixel corner, so the tie rule decides. Triangle
  _A_ (0.5, 0.5), _B_ (5.5, 1.5), _C_ (2.5, 3.5) on a 6 × 4 grid: 2·area = 13; nine centres in the closed triangle
  (Pick: 13/2 = _I_ + 3/2 − 1), its three vertices, which are centres, and six strictly inside, the ones the top-left
  rule draws (_AB_ and _BC_ are right edges, and each vertex lies on one).
- **Depth:** Proved: the viewport map, **V** = [**R**ᵀ \| −**R**ᵀ**t**], edge functions as the inside test, barycentrics
  as _E_/(2·area), the top-left rule drawing a shared-edge centre once (the edge's two orientations). Stated:
  perspective-correct interpolation (proved in 8.3), the slowest-stage model. Named: clipping, the guard band (L2 §5.5),
  real rasterizers (tiles, hierarchy; RTR 23.1). Toy first: the toy rasterizer, the GPU's rule on a 6 × 4 grid.
- **The live figure:** (1) the strip, clickable, highlighting in the scene what each stage touches; (2) the toy
  rasterizer: drag vertices, covered centres, quads and helper pixels counted, edge values and barycentric bars at the
  hovered pixel, a CW triangle culled; toggle naive: a full-screen pass as two triangles (the diagonal's quads shaded
  twice) against one big triangle; (3) the bottleneck bench on the coin room: resolution scale, triangles per coin,
  separate meshes. Panel: `renderer.info.render.calls`, triangles, frame ms, pixels. Expected relations: pixel-bound at
  half scale, about ¼ the pixel time; CPU-bound, unchanged by scale and proportional to calls.
- **Traps:** a device pixel ratio of 2 is four times the pixels; three.js hides the fixed stages behind `side`,
  `depthTest`, `depthWrite`, `transparent`; tearing without two buffers (the browser double-buffers;
  `requestAnimationFrame` paces). Capsule (browser performance): measure before optimizing, with Spector.js and the bench.
- **Exercises:** (1) The NDC example; hint: the y axis flips. (2) Edge functions by hand for the grid triangle (9 centres in the closed triangle, 6 drawn).
  (3) Predict a pixel-bound scene at half the canvas side (¼ of the pixel work). (4) The view matrix of a camera at
  (0, 2, 5) looking down −Z (a translation by (0, −2, −5)).
- **Our angle:** the drawing reads the state and never writes it. En Manifold: `createStage` draws at pixel ratio 1
  because an integrated GPU struggled with 2× ("four times the pixels"), and `probe.ts` writes each frame's draw calls and
  triangles for the browser tests.
- **Sources:** RTR 2, 3.1–3.3, 18.2; L2 §5.5; G2 §11.1, §11.4.1–3; [WebGL2 Fundamentals](https://webgl2fundamentals.org/);
  [Spector.js](https://spector.babylonjs.com/). Reuses the pilot's `toScreen` (02-la-proyeccion) for the walkthrough,
  archived 0-00, and ML 2.1–2.2 (pipeline, barycentrics).
- **Open:** none.

### 8.2 Tu primer shader (C)

- **Question:** ¿Cómo se le dice a la placa qué hacer con cada vértice y con cada píxel?
- **Before:** 8.1, 3.6.
- **Leads:** RTR 3.3 (uniform and varying inputs), 3.5 (vertex shader), 3.8 (pixel shader), 5.3.1–5.3.2 (where each
  computation belongs; a complete pair). **Also:** G2 §11.4.10; L2 Listing 7.1 (Lambert as a first shader, used in 8.5);
  The Book of Shaders.
- **Approach:** RTR's order: the shader right after the pipeline, so every later idea is "what runs per vertex, per
  pixel, what is a uniform". Hook: the coin should glow and pulse; no built-in material does it.
- **The mathematics:** the vertex shader is the chain in one line, `gl_Position = projectionMatrix * modelViewMatrix *
vec4(position, 1.0)` (three.js supplies these uniforms and attributes to `ShaderMaterial`); varyings are interpolated
  with barycentric weights (perspective-correct, 8.3); the fragment shader returns a colour. Frequencies: per draw
  (uniform), per vertex, per pixel; a 64-vertex coin covering ~2000 pixels runs its pixel code about 30× as often. Time
  in a float32 uniform: at 1 h the spacing of floats is 2⁻¹² s ≈ 0.24 ms, at 1 day 2⁻⁷ s ≈ 7.8 ms, at 30 days 0.25 s, and
  a pulse stutters (G §8.5.4.4's warning, applied). **Example:** writing linear 0.5 without the output conversion shows
  128 instead of 188 (sRGB encode of 0.5 = 0.735).
- **Depth:** Proved: the float32 spacing at 1 h, 1 day and 30 days (2.9's spacing of floats), the per-vertex against
  per-pixel count, 128 against 188 (8.6's curve). Stated: varyings are interpolated perspective-correctly (proved in
  8.3). Toy first: nothing new is delegated; the reader writes both shaders, and 8.1's toy already interpolated with
  barycentrics.
- **The live figure:** the GLSL sandbox on the coin (vertex and fragment tabs, errors by line), uniforms as sliders; toggle
  naive: a stripe pattern computed per vertex and interpolated (wrong on a coarse mesh) against per pixel; toggle the
  output conversion against a `MeshBasicMaterial` of the same colour. Panel: vertices, covered pixels, their ratio, the
  hovered pixel's value (expected 188 with the conversion, 128 without).
- **Traps:** `ShaderMaterial` gets `linearToOutputTexel` and `toneMapping` defined, but converts only if the fragment
  shader ends with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` (checked in 0.187's
  `WebGLProgram`); this is the curriculum's "Sutileza", pointing to 8.6. Normalize interpolated normals; `highp` for
  positions; compile errors appear only at the first draw.
- **Exercises:** (1) The pulse, from the step count. (2) Move the stripes from vertex to fragment and explain the
  difference. (3) The float32 spacing at 1 h and 1 day; hint: the exponent of 3600 is 11. (4) Tint by world height.
- **Our angle:** shader time is ((_n_ mod _N_) + α)·_h_: the integer step count and 2.4's α, never a float clock. Nothing a
  shader computes enters the hash. En los motores: GLSL with `WebGLRenderer`, or TSL node materials with
  `WebGPURenderer`; "Dónde Manifold eligió otra cosa": Manifold has no shader of its own yet.
- **Sources:** RTR 3.3, 3.5, 3.8, 5.3; G2 §11.4.10; [The Book of Shaders](https://thebookofshaders.com/);
  [three.js manual](https://threejs.org/manual/). Reuses ML 2.1's shader (attribute, uniform, varying; Lambert and Fresnel)
  and ML 2.5's toon shader as sandbox starters.
- **Open:** WebGL against WebGPU, as a decision (problem 4).

### 8.3 La profundidad (C)

- **Question:** ¿Cómo sabe la placa qué está delante, y por qué a veces titila?
- **Before:** 8.2; 1.10 (the projection as the division by _w_; "its depth row waits for 8.3"); 2.9 (floats).
- **Leads:** L2 §6.2–6.3.3 (1/_z_ interpolates linearly; the depth row from conditions; the far plane barely matters; the
  near plane rules; reversed depth). **Also:** RTR 4.7.2 (the 0.833 example, figs. 4.21–4.22), 23.7 (z-fighting is a
  modelling problem); G2 §11.3.10–11 (painter's algorithm; test and write as separate switches).
- **Approach:** L2's derivation, re-signed for view space looking down −Z and NDC depth in [−1, 1] (L2 Ex. 6.8). Hook: the
  painter's order fails on a cycle of three planks; and the night room's far floor tiles flicker under coins' blob
  shadows. 1.2's figure is relabelled a third time.
- **The mathematics:** (1) on a plane **n**·_P_ + _d_ = 0 not through the eye (_d_ ≠ 0), a point seen at screen
  position (_x_s_, _y_s_) is _P_ = (−*z*/_g_)(_x_s_, _y_s_, −*g*), so 1/(−*z*) = −(_n_x_ _x_s_ + _n_y_ _y_s_ − _n_z_ _g_)/(_gd_):
  affine in the screen. Hence any attribute _a_ affine on the triangle has _a_/_w_ affine too: interpolate _a_/_w_ and
  1/_w_, divide (_w_ = −*z*). (2) The depth row _z_c_ = _Az_ + _B_ with _w_c_ = −*z* gives _z_ndc_ = −*A* − _B_/_z_, already
  affine in 1/_z_ as (1) asks; the conditions −*n* ↦ −1, −*f* ↦ 1 give _A_ = −(_f_ + _n_)/(_f_ − _n_),
  _B_ = −2*fn*/(_f_ − _n_), exactly three.js's `elements[10]` and `elements[14]`. (3) Window depth
  _z_w_ = (_f_/(_f_ − _n_))(1 − _n_/_d_) at distance _d_; _z_w_ = ½ at _d_ = 2*nf*/(_n_ + _f_) < 2*n*. (4) The smallest
  separable gap in a 24-bit fixed-point buffer is, to first order, about 2⁻²⁴*d*²(_f_ − _n_)/(_fn_). **Example:** RTR's
  _n_ = 10, _f_ = 110: _z_ndc_ = 0.1, 0.833, 0.98 at 20, 60, 100. The pilot's camera (_n_ = 0.1, _f_ = 200): elements
  −1.0010005 and −0.2001001; half of all depth values lie within 0.1999 m of the eye; at 50 m the gap is 1.5 mm (with
  _n_ = 0.01, 15 mm; 0.001, 15 cm).
- **Depth:** Proved: 1/_z_ affine on the screen, hence perspective-correct interpolation in general (any attribute
  affine on the triangle), the depth row from its conditions, _z_w_(_d_), the half-depth distance, the first-order gap.
  Stated: reversed depth's gain with a float buffer, with its idea (L2 §6.3.3, "Más a fondo"). Named: logarithmic
  depth. Toy first: the toy 8-bit buffer's ticks show the precision before the real 24-bit buffer is trusted.
- **The live figure:** near and far sliders; _z_w_(_d_) with ticks for each representable value of a toy 8-bit buffer (and
  the 24-bit gap as a number); two planes δ apart at distance _D_, flickering. One knob, two failures (the near plane):
  large clips walls when the camera is close, small makes far surfaces fight. Toggle naive: affine interpolation (pass
  _a_·_w_ and _w_, divide in the fragment shader) against perspective-correct, on a receding checkerboard. Panel: _n_, _f_,
  _d_, _z_ndc_, _z_w_, the half-depth distance, the gap at _D_.
- **Traps:** coplanar surfaces need an offset (`polygonOffset`) or a move, not a smaller near; depth read back must be
  linearized; `logarithmicDepthBuffer` writes `gl_FragDepth` and loses early depth rejection; the depth buffer cannot do
  transparency (8.4). Reversed depth (`reversedDepthBuffer`, which needs `EXT_clip_control`: near goes to 1 and far to 0,
  so a float buffer's dense values meet the far distances) is the "Más a fondo".
- **Exercises:** (1) L2 Ex. 6.8: derive _A_ and _B_, check against `camera.projectionMatrix.elements`. (2) _z_ndc_ at 20, 60,
  100 for _n_ = 10, _f_ = 110. (3) The least near plane so a decal 2 mm above the floor at 30 m does not fight (_n_ > 0.027 m).
  (4) L2 Ex. 6.14: a depth offset equal to a fixed camera-space distance.
- **Our angle:** precision engineered, not hoped for: the rendering face of determinism (§6.1). En Manifold: its camera
  uses _n_ = 0.05, _f_ = 200 (3.0 mm at 50 m), and its blob shadows sit 1 cm above the ground along its normal, an offset by
  geometry.
- **Sources:** L2 §6.2–6.3.3; RTR 4.7.2, 23.7; G2 §11.3.10–11. Reuses ML 2.1's z-fighting section and ML 2.2's affine
  ("PS1") trick.
- **Open:** if the renderer were `WebGPURenderer`, NDC depth is [0, 1] and (2) changes (problem 4).

### 8.4 Lo transparente (C) ◇

- **Question:** ¿Por qué el vidrio y el humo dependen del orden en que se dibujan?
- **Before:** 8.3.
- **Leads:** RTR 5.5 (alpha as coverage times opacity; over with numbers; order; depth writes off; additive; under).
  **Also:** G2 §11.3.12; L2 §5.5.3 (blending, the destination in linear).
- **Approach:** the depth buffer keeps one surface per pixel, so it cannot keep two. Hook: a coin's glass dome shows the
  far coin through the near one in some frames and hides it in others.
- **The mathematics:** over is a convex combination (1.4's lerp): **c**o = α**c**s + (1 − α)**c**d. Two layers in the two
  orders differ by exactly α₁α₂(**c**₁ − **c**₂) (expand both): the error vanishes when either is faint, the reason order
  matters more as opacity grows (RTR fig. 5.37). Premultiplied colour makes over associative, so layers compose front to
  back (under). Additive, **c**o = **c**d + α**c**s, commutes (up to the target's rounding): sparks need no sort.
  **Example:** red (0.9, 0.2, 0.1) at α = 0.6 over blue (0.1, 0.1, 0.9) gives (0.58, 0.16, 0.42) (RTR); a bubble's edge,
  coverage ¾ times opacity 0.1, has α = 0.075.
- **Depth:** Proved: the order error α₁α₂(**c**₁ − **c**₂), over's associativity with premultiplied colour, additive's
  order-freedom. Stated: alpha as coverage times opacity, a model that takes each layer's coverage as uncorrelated with
  what lies behind (RTR 5.5). Named: order-independent transparency (depth peeling, weighted blending; RTR 5.5). Toy
  first: the blend unit is the formula itself, and the panel checks it against the drawn overlap.
- **The live figure:** three overlapping coloured quads; drag to reorder the draw list; an α slider. Toggles: depth writes
  on (a pane vanishes behind another) or off; sorting by centre against a manual order for two crossing panes (sorting
  fails). Panel: the overlap colour in this order and the swapped one, and their difference against α₁α₂(**c**₁ − **c**₂).
- **Traps:** three.js sorts transparent objects back to front by the depth of their bounding sphere's centre
  (`projectObject`, `reversePainterSortStable`) after the opaque ones, but `depthWrite` stays `true` unless you set it;
  `renderOrder` to force; `alphaTest` for cutouts (no sort, aliased edges; `alphaToCoverage` with MSAA); `alphaHash`
  trades order for noise. On the canvas the shader encodes to sRGB before blending, so blending happens on encoded values;
  it is linear only into a linear target (8.16's chain).
- **Exercises:** (1) RTR's blend in both orders. (2) Prove the α₁α₂(**c**₁ − **c**₂) identity. (3) Show additive is
  order-free. (4) Why sorting by centre fails for crossing panes, and what splitting one does.
- **Our angle:** a coin fading as it is collected is view (outside the hash). En Manifold: the ghost is drawn at opacity
  0.35 (`replays.ts`), and the blob shadows are transparent with `depthWrite: false` (`bodies.ts`).
- **Sources:** RTR 5.5; G2 §11.3.12; L2 §5.5.3.
- **Open:** linear blending needs the post chain of 8.16 (problem 5). Foldable into 8.3 as a section with the quads.

### 8.5 Luz y sombreado (C)

- **Question:** ¿Cómo se calcula de qué color se ve una superficie iluminada?
- **Before:** 8.2; 6.8 (sources with units and a windowed falloff, spot cones, **n**·**l**: how much light reaches a
  point); 3.2.
- **Leads:** L2 §7.1–7.3 (luminance; constant along a ray; the rendering equation reduced; the BRDF; Lambert as ρ/π by
  energy; Phong and Blinn–Phong), RTR 5.1–5.3 (the shading model's structure with its unlit part; light types; per-vertex
  against per-pixel; interpolated normals shorten). **Also:** G2 §12.1–12.4 (the shading equation as the rendering
  equation under two named assumptions).
- **Approach:** 6.8 measured how much light arrives; now how much leaves towards the eye. G2's framing, because it names
  its assumptions: only point and directional lights, indirect light replaced by an ambient term. Hook: our own Lambert
  shader beside `MeshLambertMaterial`, compared pixel by pixel.
- **The mathematics:** irradiance _E_ = _I_ · falloff · (**n**·**l**)⁺ (the cosine: a beam of section _A_ covers _A_/cos θ,
  L2 fig. 7.3); radiance is constant along a ray in empty space (one sentence; the 1/*r*² against *r*² proof is a "Más a
  fondo"); BRDF _f_ = _L_o_/_E_ (for light from one direction); Lambert constant, and energy (∫ cos θ dω = π over the
  hemisphere, proved by two integrals) makes it ρ/π, as three.js's `BRDF_Lambert`. Phong: **r** = 2(**n**·**l**)**n** − **l**
  ("el mismo movimiento": keep the part along **n**, flip the rest), (**v**·**r**)^α. Blinn–Phong: **h** = nrm(**l** + **v**),
  (**n**·**h**)^α; coplanar, angle(**n**, **h**) = ½ angle(**v**, **r**), so the exponent is about 4× for the same
  highlight (near its peak, where cos _x_ ≈ 1 − _x_²/2). three.js normalizes it by (α/2 + 1)/π (`D_BlinnPhong`), so that
  ∫ _D_ (**n**·**h**) dω = 1. The unlit part: ambient or hemisphere light. **Example:** _I_ = 100 cd at 5 m,
  **n**·**l** = 0.6, range 10 m: _E_ = 4 · 0.6 · 0.879 = 2.11 lx; ρ = 0.5: _L_ = 0.336 (encoded 0.614 without tone
  mapping).
- **Depth:** Proved: the cosine law for irradiance, ∫ cos θ dω = π and hence Lambert's ρ/π, the reflection vector, the
  coplanar half-angle fact. Stated: radiance constant along a ray (proof in "Más a fondo", L2 §7.1); three.js's
  Blinn–Phong constant (exercise 2's integral, with cos^(α+1)); G2's shading equation (G2 §12.1–12.4). Named: the
  rendering equation in full. Toy first: our Lambert shader against `MeshLambertMaterial`, pixel by pixel.
- **The live figure:** a sphere and a floor under a point light: distance, intensity (cd), range, shininess; Lambert,
  Blinn–Phong and ambient toggles; tessellation with per-vertex against per-pixel (naive toggle). The big floor of two
  triangles with a 10 cd lamp 1 m above its centre: 10 lx at the centre, 0.027 lx at the corners, so per-vertex loses the
  spot. Panel: at the hovered pixel **n**, **l**, **h**, _E_, _L_, and ours minus three.js's (below 1/255).
- **Traps:** clamp **n**·**l**; renormalize after interpolation and recompute **l** per pixel; lights live in view space in
  three.js; an unnormalized Blinn–Phong (L2's) dims as the exponent grows.
- **Exercises:** (1) The example by hand. (2) ∫ cos θ dω = π. (3) The half-angle fact; hint: the plane of **l**, **v**, **n**.
  (4) The two-triangle floor's four vertex values.
- **Our angle:** 6.8's meter is this lesson's _E_; 8.7 makes them literally the same function. En Manifold: a hemisphere
  sky and a sun whose intensities scale with the world's ambient light (`stage.ts`'s `daylight`).
- **Sources:** L2 §7.1–7.3; RTR 5.1–5.3; G2 §12.1–12.4; [LearnOpenGL, lighting](https://learnopengl.com/). Reuses ML 2.1's
  Lambert.
- **Open:** none.

### 8.6 El color no es lineal (C)

- **Question:** ¿Por qué dos luces de 0,5 no se ven como una de 1?
- **Before:** 8.5.
- **Leads:** RTR 5.6 (compute linear, encode at the end; the two overlapping spotlights), 8.2 (scene-referred against
  display-referred; tone curves; exposure); L2 §5.2–5.3 (colour from cones; chromaticity; sRGB's primaries; the curve's
  linear segment; gamma as compression). **Also:** G2 §11.2.3, §12.7.1.
- **Approach:** RTR's argument, now that lights add (decided in the curriculum). Hook: two spots overlapping on the floor,
  drawn with the output encoding off: one spot looks dim, the overlap blinding. L2's derivations go in "Más a fondo"
  (chromaticity is the perspective divide again; the luminance weights from a 3×3 solve).
- **The mathematics:** the sRGB curve: 12.92*C* up to 0.0031308, then 1.055*C*^(1/2.4) − 0.055; the joint meets in value
  to four digits (0.04045) and nearly in slope (12.92 against 12.70); the straight piece avoids a pure power's infinite
  slope at 0. Encoding spends codes where the eye tells darks apart. Light adds in linear terms; encoding does not
  commute with addition. Luminance _Y_ = 0.2126*R* + 0.7152*G* + 0.0722*B* (linear, for sRGB's primaries and white).
  Tone mapping maps unbounded scene values to the display: exposure first, then a curve (Reinhard _x_/(1 + _x_):
  3 ↦ 0.75, 0.5 ↦ 0.333; ACES, AgX, Neutral in three.js). **Example:** each spot gives linear 0.5, the overlap 1.0.
  Correct: shown as 188 and 255, a luminance ratio of 2. Naive: 128 and 255, which the screen shows as 0.216 (sRGB's decoding of 128/255) and 1, a
  ratio of 4.63.
- **Depth:** Proved: the joint's value and slope, that encoding does not commute with addition (the example is the
  counterexample), Reinhard's values. Stated: the luminance weights (the 3×3 solve, "Más a fondo", L2 §5.2–5.3); that
  the eye tells darks apart better, a fact of perception (RTR 5.6, L2 §5.3). Named: colorimetry beyond sRGB (CIE XYZ,
  the cones), ACES and AgX as fitted curves. Toy first: hand-written Reinhard and encoding before three.js's.
- **The live figure:** the two spots with a pipeline switch (correct, no encoding, encoded twice); a grey ramp quantized
  to 5 bits, linear against encoded (banding in the darks); the tone curve with an exposure slider and three.js's curves.
  Panel: the hovered pixel's linear value, its code (0–255), _Y_, and the displayed overlap-to-single ratio (2.00 against
  4.63).
- **Traps:** a hex colour is sRGB and three.js stores it linear (`Color.setHex`, color management on); `outputColorSpace`
  defaults to sRGB, `toneMapping` to none; colour textures need `colorSpace = SRGBColorSpace`, data textures none;
  encoding twice; lerping encoded colours; post-processing after the encoding.
- **Exercises:** (1) Encode 0.1, 0.2, 0.5 by the formula (0.349, 0.485, 0.735) and with γ = 2.2 (RTR's 0.351, 0.481,
  0.730). (2) Check the joint's value and slope. (3) L2 Ex. 5.5: a cubic approximating the decoding curve, from four
  conditions. (4) The luminance of the player's colour.
- **Our angle:** the game's meter never touches an encoded colour (6.8). Exposure is fixed, never automatic: in a stealth
  game an adapting eye would tell the player a dark corner is lit while the guard, which reads linear light, sees them.
- **Sources:** RTR 5.6, 8.2; L2 §5.2–5.3; G2 §11.2.3, §12.7.1; [LearnOpenGL, gamma](https://learnopengl.com/Advanced-Lighting/Gamma-Correction).
  Reuses ML 2.3's hand-written Reinhard and gamma as the "by hand" rung; recalls 1.3's "Sutileza" and 1.4's "Más a fondo".
- **Open:** none.

### 8.7 La luz del proyecto (P)

- **Question:** ¿Cómo se ilumina el proyecto con luces que miden lo mismo que el juego?
- **Before:** 8.6 (and 6.8, 6.16).
- **Leads:** the part's own synthesis of L2 §8.1 (sources with units, falloffs from conditions) and 8.5–8.6. **Also:**
  three.js's light shading (checked in 0.187).
- **Approach:** hook: the HUD meter says 1.3 lx while the floor around the player looks bright, or the reverse; the
  player cannot trust their eyes. One falloff for both: three.js's own. In 0.187 a point or spot light attenuates by
  (1/max(_d_^decay, 0.01)) · sat(1 − (_d_/_r_)⁴)² (`getDistanceAttenuation`) and a spot by smoothstep(cos θ_out, cos θ_in, cos θ)
  (`getSpotAttenuation`, with θ_in = θ_out(1 − penumbra)). With decay 2 that is × and ÷ only: (_d_/_r_)⁴ = (*d*²/*r*²)², no
  square root needed. The simulation (`light.ts`) computes it exactly and in the hash; the drawing sets `decay = 2`,
  `distance = range`, intensity in candela.
- **The project:** `light.ts` gains `falloff(d2, range)` and `spotFactor`; `lamps.ts`'s `drawLamps` makes one light per
  simulation lamp (the view may use `Math.acos` to turn stored cosines into `angle` and `penumbra`); the world's ambient
  becomes an `AmbientLight` in lux (no normal dependence, so the two agree); `createView` gains tone mapping (Neutral or
  AgX) and a fixed exposure; `glow.ts` is a `ShaderMaterial` for the coin: emissive pulse from the step count, ending in
  the tone-mapping and colour-space includes. **Example:** a 40 cd lamp of range 8 m, 3 m up; a point 3 m away on the floor:
  *d*² = 18, window 0.848, **n**·**l** = 0.707, _E_ = 40/18 · 0.848 · 0.707 = 1.33 lx; a white Lambert patch (ρ = 0.5) is drawn
  at linear 0.212. Console: `show.lightmeter` (view: meter and drawn _E_ at the player); `lamp.set 2 intensity 80` (world, at
  a step); recipe `seed 1; restart; step 300; light.at player` prints _E_, and `view.exposure 2; step 1; hash` gives the
  same hash as without it.
- **Depth:** No new theorem: 8.5–8.6 applied. Proved: (_d_/_r_)⁴ = (_d_²/_r_²)², so no square root; the example's _E_;
  where the window halves. Stated: three.js 0.187's two attenuation formulas, read from its source, not derived (the
  window is Frostbite's choice of a smooth cut to zero at _r_). Toy first: `light.ts`'s falloff, by hand, is the
  reference the drawn light is read back against (within 1%).
- **The live figure:** the project's room with the probe at the player: the meter's _E_ against the drawn patch read back
  from a float target (×π/ρ), within 1%. Toggle naive: decay 1 with a fudge factor (Manifold's choice) against the shared
  falloff.
- **Traps:** pre-r155 tutorials multiply intensities by π; the 0.01 clamp (match it); `penumbra` is a fraction of the
  angle, not an angle; spot `angle` at most π/2; a hemisphere light depends on the normal, an ambient one does not.
- **Exercises:** (1) The example's _E_, and at 6 m. (2) Where three.js's window halves the inverse square (sat(1 − *x*⁴)² = ½
  at _x_ = (1 − 1/√2)^¼ ≈ 0.736). (3) Choose the exposure so the guard's threshold _E_T_ shows as mid-grey.
- **Our angle:** the drawing says what the guard knows. "Dónde Manifold eligió otra cosa": Manifold's lamps fall linearly
  in the simulation, 1 − _d_/_r_ (`core/src/world.ts`), and are drawn with decay 1 and a factor 6 (`lights.ts`, "about
  linear"); but decay 1 is 1/_d_ times the window, so for a lamp of range 8 m the drawn-to-logic ratio goes from 6.9 at
  1 m to 1.9 at 6 m.
- **Sources:** L2 §8.1; RTR 5.2; three.js `lights_pars_begin.glsl.js`.
- **Open:** 6.8's falloff and normal must be these (problem 1); the environment light of 8.13 must enter the meter or stay
  out of the reference patch.

### 8.8 Texturas (C)

- **Question:** ¿Cómo se pega una imagen sobre una superficie?
- **Before:** 8.2, 3.6.
- **Leads:** RTR 6.1–6.2 (the texturing pipeline; the brick example; bilinear; magnification; minification and mipmaps;
  anisotropy), 6.5–6.6 (material and alpha maps, cutouts). **Also:** L2 §7.4 (texels, repeat keeps the fraction, data in
  textures, cube faces by the largest coordinate, the origin trap); G2 §11.3.14 (texel density).
- **Approach:** RTR's pipeline, each step a control: position → projector → (_u_, _v_) → corresponder (wrap) → texel →
  value → a shading input. Hook: the night room's floor tiles and the coin's engraved face.
- **The mathematics:** (_u_, _v_) interpolated perspective-correctly (8.3) by barycentrics (3.6); repeat = _u_ − ⌊_u_⌋; texel
  centres at (_i_ + 0.5)/_W_; nearest ⌊_uW_⌋; bilinear as two lerps with the fractional parts; minification: footprint
  ρ = max(\|∂(_uW_, _vH_)/∂*x*\|, \|∂/∂*y*\|), level λ = log₂ ρ, trilinear between two levels, anisotropic along the long axis.
  The mip chain costs 1/3 more (1 + ¼ + ¹⁄₁₆ + … = 4/3). **Example** (RTR): (0.32, 0.29) on 256²: (81.92, 74.24), nearest
  texel (81, 74), sRGB (0.9, 0.8, 0.7) = linear (0.787, 0.604, 0.448); bilinear from (81.42, 73.74): weights 0.151,
  0.109, 0.429, 0.311. A 2048² RGBA8 texture is 16 MiB on the GPU, 21.3 MiB with mips, whatever the PNG weighs.
- **Depth:** Proved: repeat as the fractional part, texel centres, bilinear as two lerps, the footprint as the
  derivative of the texel coordinate, the mip chain's 4/3. Stated: λ = log₂ ρ as the GL rule, which GPUs may
  approximate; anisotropic filtering, whose probes each GPU chooses (RTR 6.2.2). Toy first: the zoomed 8 × 8 texture
  is sampled by hand before the GPU's sampler is used.
- **The live figure:** a zoomed 8 × 8 texture with its grid and centres; drag the sample; nearest against bilinear (naive
  toggle); the four weights as bars. A UV view: hover a triangle in 3D, it lights in UV space (L2 fig. 7.8). Wrap modes on a
  floor with _u_ ∈ [0, 4]. Panel: (_u_, _v_), texel, weights, linear value, GPU bytes per texture.
- **Traps:** `flipY` is true for `Texture`, false for glTF's; data maps must not be sRGB; texture transforms act in reverse
  (they move the space); repeats noticed after about three; dispose textures (6.2); sRGB textures are decoded before
  filtering in WebGL2, so mips filter in linear.
- **Exercises:** (1) The brick example at (0.5, 0.5). (2) The level for a 1024² texture at 8 texels per pixel (3). (3) Prove
  the 4/3. (4) The night room's texture memory.
- **Our angle:** textures are resources, counted (§6.5) and measured in 8.17. A projector is a chart of a surface: part
  10's parametrized surfaces start here. Manifold todavía no tiene texturas propias (its models are flat colours).
- **Sources:** RTR 6.1–6.2, 6.5–6.6; L2 §7.4; G2 §11.3.14. Reuses ML 2.2's texture section.
- **Open:** none.

### 8.9 Muestrear: por qué tiembla lo lejano (C) ◇

- **Question:** ¿Por qué lo lejano parpadea, y cómo se evita?
- **Before:** 8.8; 2.4 (the drawn frame samples the simulation).
- **Leads:** RTR 5.4 (sampling theory: the wagon wheel, Nyquist, reconstruction; MSAA, post antialiasing, temporal),
  6.2.2 (minification and mipmaps).
- **Approach:** one idea seen three times: a pixel, a frame and a step are samples. Hook: the far floor shimmers as the
  camera walks, a thin railing crawls, and a spinning coin seems to turn backwards.
- **The mathematics:** sin(2π*fn*/_f_s_) = sin(2π(_f_ − _f_s_)_n_/_f_s_), so frequencies above _f_s_/2 come back as aliases
  (Nyquist's easy half, proved; the other half, that a signal with no frequency at or above _f_s_/2 is recovered exactly
  from its samples, is stated with RTR 5.4's picture); a texture's one-texel stripes have frequency ½, so a pixel per
  texel at least; prefilter over the footprint (mipmaps are a box pyramid). Edges: MSAA (several coverage samples, one shading), supersampling, post filters, temporal reuse. three.js:
  `antialias: true` is MSAA on the canvas, and a render target needs `samples`. **Example:** an 8-spoke coin at 7 rev/s
  shows 56 spokes per second; drawn at 60 Hz that aliases to −4 per second, a slow turn backwards at 0.5 rev/s (at 30 Hz
  too; at 144 Hz it is true). The floor 30 m away seen from 1.7 m with a 60° field and 1080 rows: a pixel at the screen's centre
  spans 2 tan 30°/1080 rad, so 3.2 cm across and 57 cm along the floor; a 1 m tile of 512 texels gives 16 × 291
  texels, levels 4.0 and 8.2, anisotropy 18:
  trilinear alone blurs, 16× anisotropic keeps it sharp.
- **Depth:** Proved: the alias identity and its numbers (the coin, the 50 Hz wobble), the stripes' ½, the footprint.
  Stated: the sampling theorem's reconstruction half, which justifies prefiltering (RTR 5.4; proof in PBRT 4th ed.
  §8.1); a mipmap as a box prefilter, not the ideal one. Named: reconstruction filters, MSAA's and temporal
  antialiasing's machinery (RTR 5.4). Toy first: the sampled-sine plotter, before the GPU's filters.
- **The live figure:** the coin with spin and frame-rate sliders; a sampled sine with its alias; the receding checkerboard
  with filter menu (nearest, no mips, trilinear, anisotropy 4 and 16) and mip levels as colours; MSAA on a railing. One knob,
  two failures (filtering, as LOD bias): negative shimmers, positive blurs, both measured (frame-to-frame flicker on a slow
  pan; contrast). Panel: apparent spin, alias frequency, hovered mip level, anisotropy.
- **Traps:** mipmaps of alpha cutouts thin foliage away (RTR figs. 6.29–6.30); specular highlights alias too (three.js adds
  a geometric roughness from the normal's derivatives); `devicePixelRatio` changes the footprint.
- **Exercises:** (1) The coin at 7 rev/s at 60, 30 and 144 Hz. (2) Prove the alias identity. (3) The footprint numbers.
  (4) A 50 Hz wobble in the simulation, drawn every step at 60 Hz: what is seen (10 Hz).
- **Our angle:** the fixed step is a sampler too: "the drawn frame is a sampling of the simulation" (2.4's "Sutileza")
  comes back here, and a physics oscillation above 30 Hz cannot be shown faithfully.
- **Sources:** RTR 5.4, 6.2.2.
- **Open:** none; foldable into 8.8 with the checkerboard figure.

### 8.10 Mapas de normales (C)

- **Question:** ¿Cómo parece rugosa una superficie plana?
- **Before:** 8.8, 8.5, 1.6.
- **Leads:** L2 §7.5–7.6 (tangent space from a 2×2 system; Gram–Schmidt by rejection; the handedness σ; normals from
  heights), RTR 6.7–6.8 (Blinn's idea, encodings, tangent space as the standard, mirrored UVs, flattening at grazing,
  parallax). **Also:** G2 §11.6.2.
- **Approach:** Blinn: leave the geometry, perturb the normal the light reads; it works because shading only reads
  normals. Hook: the night room's walls look like painted paper under the guard's lantern; real bricks cost triangles.
- **The mathematics:** edges **e**₁ = Δ*u*₁**t** + Δ*v*₁**b**, **e**₂ = Δ*u*₂**t** + Δ*v*₂**b**, so [**t** **b**] = [**e**₁ **e**₂] times the
  inverse of the 2×2 UV matrix (invertible unless the triangle's UVs are collinear); average per vertex;
  **t**′ = nrm(**t** − (**t**·**n**)**n**) ("el mismo movimiento"), σ = sign((**n** × **t**′)·**b**), **b**′ = σ(**n** × **t**′);
  TBN orthonormal, so its inverse is its transpose (1.9). three.js stores the tangent as a vec4 with σ in _w_
  (`computeTangents`) and rebuilds the bitangent from it; without one it builds the frame per pixel from derivatives. Decode _n_t_ = 2·texel/255 − 1. From heights: **m** = nrm(−∂*h*/∂*x*, −∂*h*/∂*y*, 1).
  **Example:** floor triangle (0, 0, 0), (1, 0, 0), (0, 0, −1) with UVs (0, 0), (1, 0), (0, 1): **t** = (1, 0, 0),
  **b** = (0, 0, −1), σ = +1; mirror _u_ at the second vertex and **t** = (−1, 0, 0), σ = −1. Texel (200, 128, 220) decodes to
  (0.569, 0.004, 0.725), length 0.922, normalized (0.617, 0.004, 0.787): lit head-on it gives 0.787 instead of 1.
- **Depth:** Proved: the frame from the 2×2 solve, Gram–Schmidt and σ, the transpose as the inverse of an orthonormal
  frame, a height field's normal from two tangents. Stated: why the trick convinces (shading reads only the normal;
  silhouettes and grazing views give it away, RTR 6.7–6.8); the per-vertex average is a choice, not a theorem. Named:
  MikkTSpace, the tangents glTF asks for; parallax mapping. Toy first: the floor's frame by hand before `computeTangents`.
- **The live figure:** a wall with a brick normal map under a draggable light; maps on and off (naive toggle); per-pixel
  normals as arrows; the TBN at a vertex; mirrored UVs with σ ignored (the bumps light from the wrong side) and used; a
  grazing-view slider (flattening, a flat silhouette); paint heights and see the normal map. Panel: texel RGB, decoded and
  world normal, **n**·**l** mapped and flat, σ.
- **Traps:** normal maps are linear data; green up or down differs by tool (`normalScale.y = −1` flips); mirrored UVs need
  σ; a non-orthogonal frame cannot be inverted by transposing; mipmapped normals shorten (the bridge to roughness, 8.11).
- **Exercises:** (1) The decode and its lighting. (2) The floor frame, mirrored and not. (3) A normal from a 3 × 3 height
  patch by central differences. (4) L2 Ex. 7.5: scaling heights by _k_.
- **Our angle:** "el mismo movimiento" (§6.2) and the determinant's sign (1.8), which carried once round a Möbius strip
  flips (10.6). Tangents transform as directions; normals with the inverse transpose (3.2).
- **Sources:** L2 §7.5–7.6; RTR 6.7–6.8; G2 §11.6.2. Reuses ML 2.3's TBN and `heightAt` finite differences.
- **Open:** a tangent row for the "what transforms how" table (problem 6).

### 8.11 Materiales físicos (C)

- **Question:** ¿Por qué el metal y el plástico reflejan distinto, y de dónde viene la luz que no sale de una lámpara?
- **Before:** 8.10, 8.6, 8.9.
- **Leads:** RTR 9.1, 9.3, 9.5–9.8 (light meets matter; the BRDF and the reflectance equation; reciprocity, energy; Fresnel
  and Schlick; F₀; metalness; microfacets, GGX, masking and shadowing), 10.2–10.6 (environment maps, prefiltered by
  roughness; irradiance). **Also:** G2 §12.4.3–4, §12.5.2–4; LearnOpenGL (PBR). L2 has no microfacets (curriculum §3).
- **Approach:** RTR's physics-first route. Hook: Blinn–Phong's shininess is a knob without a meaning: the gold coin and
  the plastic crate look alike, and every face turned from the lamps is black.
- **The mathematics:** _L_o_ = ∫ _f_ _L_i_ (**n**·**l**) dω, a sum for point lights (8.5's assumption); Fresnel rises at grazing,
  Schlick _F_ = *F*₀ + (1 − *F*₀)(1 − cos θ)⁵, *F*₀ ≈ 0.04 for dielectrics, coloured for metals; metalness *F*₀ = mix(0.04,
  base, _m_), diffuse = base·(1 − _m_); Cook–Torrance _FGD_/(4(**n**·**l**)(**n**·**v**)), GGX
  _D_ = α²/(π((**n**·**h**)²(α² − 1) + 1)²), α = roughness² (three.js "UE4's roughness"). Normalization ∫ _D_(**n**·**h**) dω = 1
  (a substitution _u_ = cos²θ; the mathematician's exercise). Environment light: the reflection direction looks up a
  prefiltered map, a mip per roughness (`PMREMGenerator`, `scene.environment`). **Example:** *F*₀ = 0.04: _F_(60°) = 0.070,
  _F_(85°) = 0.649. _D_ at its peak is 1/(πα²): 5.09 at roughness 0.5, 81.5 at 0.25 (sharper and brighter, with
  ∫ _D_(**n**·**h**) dω = 1 still).
- **Depth:** Proved: GGX's normalization (exercise 1), _D_'s peak, the Schlick values. Stated: Schlick as a fit to
  Fresnel's equations (RTR 9.5); Cook–Torrance with the idea of its 4 (the half vector's change of variables) and Smith's
  masking (RTR 9.7–9.8); prefiltering as an approximation (RTR 10.5). Named: Fresnel from Maxwell, the energy GGX loses
  at high roughness (RTR 9.8.2). Toy first: ML 2.3's hand-written Cook–Torrance; PMREM is used, not built.
- **The live figure:** a 5 × 5 grid of spheres, roughness by metalness, under one environment; a Fresnel curve with an *F*₀
  slider, exact Schlick against three.js's (it uses Epic's exp2 fit, at most 0.004 away, near grazing); a GGX lobe
  with a roughness slider. Toggle naive: no environment (black faces). Panel: *F*₀, _F_(θ) both ways, α, _D_ peak.
- **Traps:** roughness and metalness maps read the green and blue channels; an environment map not prefiltered;
  `MeshStandardMaterial` clamps roughness at 0.045 and adds a roughness from the normal's derivatives (0.187), so a "perfect
  mirror" still blurs a little (specular antialiasing, 8.9); metal and non-metal blended at texel edges.
- **Exercises:** (1) Prove ∫ _D_(**n**·**h**) dω = 1 for GGX. (2) The two Fresnel values. (3) The gold coin's *F*₀ and diffuse.
  (4) Why roughness 0 still blurs in three.js.
- **Our angle:** the game's meter uses only the diffuse light (ρ/π·_E_): play never depends on a highlight. Roughness is
  unresolved geometry (RTR fig. 9.25): 8.10's bumps seen from far away.
- **Sources:** RTR 9.1, 9.3, 9.5–9.8, 10.2–10.6; G2 §12.4.3–4, §12.5.2–4; [LearnOpenGL, PBR](https://learnopengl.com/PBR/Theory).
  Reuses ML 2.3's Cook–Torrance written by hand.
- **Open:** none.

### 8.12 Sombras (C)

- **Question:** ¿Cómo sabe un píxel si la luz lo ve?
- **Before:** 8.3, 8.5, 1.11.
- **Leads:** RTR 7.1, 7.4–7.6 (umbra and penumbra; shadow maps; fitting the light's frustum; bias, acne and Peter Panning;
  slope-scale and normal offset; resolution and cascades; PCF), L2 §8.3 (a shadow map is a depth buffer from the light;
  acne as a sampling mismatch, a bias that grows with tan θ, clamped; stable cascades, texel snapping). **Also:** G2
  §12.5.6–7.
- **Approach:** shadows are visibility from the light: 8.3's depth buffer, rendered from the lamp. Hook: the logic (6.8)
  says the player behind the crate is in shadow, and the drawing shows no shadow at all. RTR's warning first: any shadow
  beats none (a blob, as Manifold draws).
- **The mathematics:** the light's camera (look-at, 1.16; perspective for a spot, orthographic for the sun, six views for a
  point light); the test: _P_ to light clip space, to [0, 1]; shadowed iff _z_P_ − bias > _z_map_(_u_, _v_). Acne: the map holds
  depth at texel centres; on a surface tilted by θ from the direction the map measures depth along (the sun's rays; a
  spot's axis, near its centre), depth varies across a texel by about texel·tan θ, so the bias must exceed half that;
  too much bias leaks light (the shadow detaches). Texel size = frustum width / map size. PCF returns the fraction of
  passing comparisons, which approximates RTR's "fraction of the light visible" and the logic's partial light (its
  kernel is fixed, not the lamp's size). **Example:** a spot 3 m up with a 45° half-angle covers 6 m of floor, 5.9 mm per texel at 1024²; at θ = 45°
  the bias needs about 3 mm. RTR's 100 m sun frustum at 2048 gives 4.9 cm texels; fitted to a 20 m room, 9.8 mm.
- **Depth:** Proved: the shadow test as 8.3's depth comparison, the texel size, the acne bound ½·texel·tan θ, the
  frustum-fit numbers. Stated: PCF as an approximation of partial visibility; slope-scale bias, normal offset and
  cascades with their idea (RTR 7.4–7.6, L2 §8.3). Named: PCSS, VSM and ESM, ray-traced shadows. Toy first: ML 2.4's
  two-pass shadow map by hand, then three.js's `LightShadow`.
- **The live figure:** the bias knob from 0 to large, both failures measured: acne (the share of a lit test patch wrongly
  shadowed) and leak (the gap between a box's base and its shadow, in cm); map resolution; the depth map seen from the
  light; toggle naive: default shadow-camera bounds against fitted. Panel: texel at the floor, bias, acne %, leak.
- **Traps:** three.js 0.187 removed `PCFSoftShadowMap` (it warns and uses `PCFShadowMap`, whose PCF takes five taps on a
  rotated Vogel disk, softened by `shadow.radius`); `shadow.bias` is in the light camera's depth units (nonlinear for a
  spot, 8.3 again) while `normalBias` is in metres along the normal; `castShadow` and `receiveShadow` per mesh; a point light
  costs six depth passes; VSM leaks. Capsule (browser performance): static lights need not re-render their maps
  (`shadowMap.autoUpdate = false`, `needsUpdate` when something moves).
- **Exercises:** (1) Why a low sun stripes the floor and a high one does not (tan θ). (2) The two texel sizes. (3) The bias
  for a 1 cm texel at 60° (0.87 cm). (4) L2 Ex. 8.4, a cascade's fixed diameter ("Más a fondo").
- **Our angle:** "una perilla, dos fallas" at its purest; snapping a moving shadow camera to texels is the fixed step again
  (L2). A mirror is a portal with det < 0, which flips winding (part 10). En Manifold: blob shadows only (`bodies.ts`): a
  disc on what a ray down finds, smaller and fainter with height.
- **Sources:** RTR 7.1, 7.4–7.6; L2 §8.3; G2 §12.5.6–7; [LearnOpenGL, shadow mapping](https://learnopengl.com/Advanced-Lighting/Shadows/Shadow-Mapping).
  Reuses ML 2.4's two-pass shadow mapping.
- **Open:** the readers' and sources' `PCFSoftShadowMap` (problem 2).

### 8.13 Superficies y sombras del proyecto (P)

- **Question:** ¿Cómo se le dan al proyecto materiales y sombras que no fallen?
- **Before:** 8.11, 8.12.
- **Leads:** the synthesis of 8.8–8.12. **Also:** three.js's `MeshStandardMaterial`, `PMREMGenerator`, `RoomEnvironment`,
  `LightShadow`.
- **Approach:** hook: 8.7's room lights correctly but looks like grey clay, and its shadows are the logic's only.
- **The project:** `materials.ts`'s `materialFor(kind)` reads a material table in the level data (base colour or map,
  roughness, metalness, normal map), loading through 6.2's registry with the colour space set by role (colour maps sRGB,
  data maps none); `environment.ts`'s `setEnvironment` prefilters a room environment with PMREM at a low intensity;
  `shadows.ts`'s `enableShadows` turns them on, `fitShadow` fits each shadowed spot's camera to the room, and `normalBiasFor`
  gives 8.12's bias from the texel size; `drawLamps` casts shadows for the lamps the level marks (at most four, the budget).
  Console (view): `view.shadow.bias`, `view.shadow.size`, `show.shadowcam`, `view.env`, `show.agreement`: the logic's
  lit-or-shadowed verdict on a grid of floor points against the drawn one, read back. Recipe: `seed 2; restart;
show.agreement` prints at least 98%; `view.shadow.bias 0` drops it (acne), `view.shadow.bias 0.02` too (leaks);
  `step 600; hash` is the same at any bias.
- **Depth:** No new theorem: 8.11–8.12 applied. Stated: the 98% is a measured tolerance, not an identity (problem 7);
  PMREM's prefiltering, as 8.11 states it. Toy first: the agreement test reads the drawn shadow against the logic's
  exact rays, the reference built by hand in part 6.
- **Traps:** texture memory (8.8) counted in `renderer.info.memory`; the environment adds light the meter does not count
  (keep it out of the agreement test, or add it to the logic's ambient); normal maps without tangents in glTF.
- **Exercises:** (1) Give the crates a metal edge with a metalness map. (2) Measure the agreement against map size. (3) Fit
  the lantern's shadow camera as it moves.
- **Our angle:** drawn shadow and logic agree up to a texel and a bias, and the number says by how much.
- **Sources:** RTR 7.4, 9.5–9.8; three.js manual.
- **Open:** how the agreement is read back (a debug pass writing the shadow factor to a float target is the proposal);
  its tolerance (problem 7).

### 8.14 Ver menos para dibujar más (C)

- **Question:** ¿Cómo se deja de dibujar lo que no se ve?
- **Before:** 8.1, 3.4 (planes; the plane–box test by projected extent), 3.12 (broad phase, its BVH section).
- **Leads:** L2 ch. 9 (the GPU culls only after vertex shading; frustum culling with spheres and boxes; the near plane;
  shadow casters outside the view; portals), RTR 19.2–19.9 (the catalogue; hierarchical culling with three outcomes; plane
  masking; LOD and hysteresis), 22.14 (planes from the rows of **PV**; false positives at corners; conservative tests).
  **Also:** E ch. 6; G2 §11.5.
- **Approach:** hook: 500 coins and 300 pieces of debris put the frame over budget, though most are behind the camera.
  Planes return: L2's "a plane is a row and travels with the inverse".
- **The mathematics:** inside the clip cube means −*w* ≤ _x_c_ ≤ _w_, i.e. (row₄ + row₁)·_P_ ≥ 0 with rows of **M** = **PV**: the
  six planes are row₄ ± rowᵢ (Gribb–Hartmann), normalized to measure distance; three.js's `Frustum.setFromProjectionMatrix`
  does exactly this. A sphere is culled iff its signed distance to some plane is below −*r*: that implies it is
  outside, not conversely (near the corners); box by projected extent (3.4). Tests are conservative: they may say
  "maybe" wrongly (time), never "invisible" wrongly (correctness). A BVH (3.12) with three outcomes and plane masking.
  **Example:** fov 60°, aspect 1, _n_ = 0.1, _f_ = 100: left plane (_g_, 0, −1, 0)/2 = (0.866, 0, −0.5, 0); a sphere of
  radius 1 at (−6, 0, −10) is at −0.196 (kept), at (−8, 0, −10) at −1.928 (culled). The near plane comes out as
  −*z* − 0.1 ≥ 0.
- **Depth:** Proved: the six planes from the rows of **PV**, the sphere and box tests and why they are conservative,
  plane masking's one-line reason (a child inside a parent's half-space needs no test). Stated: what a BVH saves, a
  cost argued and measured (3.12). Named: occlusion culling (hierarchical _z_, visible sets; RTR 19.7), portals ("Más a
  fondo"). Toy first: `cull.ts` by hand against three.js's `Frustum`, plane by plane.
- **The live figure:** the frustum from above with many spheres coloured in, out and straddling, the selected one's six
  distances against its radius; boxes with the false-positive region near corners; a BVH coloured by outcome with plane
  tests counted. Toggle naive: no culling, or per object without hierarchy. Panel: objects tested, plane tests, draw calls,
  triangles, culled %, frame ms.
- **Traps:** three.js culls by bounding spheres only; an `InstancedMesh` has one sphere for all copies, computed once and
  never updated when instances move (call `computeBoundingSphere`); an animated `SkinnedMesh` should recompute its sphere
  every frame (its own documentation says so), or characters vanish at the screen's edge; shadow passes use the light's
  frustum, so casters outside the view still cast.
- **Exercises:** (1) Derive the left plane. (2) Classify five spheres. (3) Prove a conservative test never rejects wrongly,
  and build a false positive. (4) A 1 m coin's projected size at 10 and 20 m (it halves).
- **Our angle:** "se reduce a" a signed distance (3.4); hysteresis returns from 7.8 in LOD switching. En Manifold: debug
  lines turn culling off (`frustumCulled = false` in `views.ts`), and the browser tests read draw calls and triangles.
- **Sources:** L2 ch. 9; RTR 19.2–19.9, 22.14; E ch. 6; G2 §11.5. Reuses ML 2.4's Gribb–Hartmann culling.
- **Open:** portals as a "Más a fondo" here or in 10.7.

### 8.15 Muchas copias de una malla (C) ◇

- **Question:** ¿Cómo se dibujan mil monedas en una sola llamada?
- **Before:** 8.1, 3.13.
- **Leads:** RTR 18.4 (each call and state change costs CPU; instancing). **Also:** GPP ch. 3 (Flyweight); three.js's
  `InstancedMesh` and `BatchedMesh`.
- **Approach:** GPP's Flyweight turned into a draw call: shared geometry and material once, a per-instance stream of
  matrices and colours. Hook: 1000 coins as 1000 meshes; 8.1's bench says CPU-bound (frame time unchanged by canvas size,
  proportional to calls).
- **The mathematics:** a cost model, frame CPU ≈ _c_call_·_N_calls_ + _c_obj_·_N_ against _c_call_ + _c_upload_·64 B·_N_; each
  instance matrix is **TRS** (1.11) composed once per change, 16 floats. **Example:** 2000 moving coins upload 128 KB per
  frame; 1000 → 1 call. The crossover is measured on the reader's machine, not assumed.
- **Depth:** No theorem: a linear cost model whose constants are measured, never assumed; the 64 bytes per copy are
  counted. Stated: what instancing does on the GPU (one draw, the vertex shader reading each copy's matrix; RTR 18.4).
  Named: multi-draw and GPU-driven rendering (`BatchedMesh` uses the first). Toy first: the thousand separate meshes,
  the naive rung, measured before `InstancedMesh`.
- **The live figure:** _N_ from 10 to 10 000; separate meshes against one `InstancedMesh` (naive toggle). Panel:
  `renderer.info.render.calls`, triangles, CPU ms, uploaded bytes.
- **Traps:** `instanceMatrix.needsUpdate` (a dirty flag) and update ranges; one bound for all copies (8.14);
  `setColorAt`; raycasts return `instanceId`; removing copy _k_ by swapping with the last and decrementing `count` changes
  which entity is where (keep a map). Capsule (browser performance): typed arrays and `DynamicDrawUsage`, only when the
  profiler asks (curriculum §7.1.16).
- **Exercises:** (1) Bytes per frame for 2000 moving coins. (2) Swap-with-last and the entity map. (3) Find the crossover.
  (4) What `BatchedMesh` adds (per-copy culling, several geometries).
- **Our angle:** the instance order follows the simulation's entity order; the view never reorders the state. "Dónde
  Manifold eligió otra cosa": its debris is fourteen separate meshes (`debris.ts`), where instancing would not pay.
- **Sources:** RTR 18.4; GPP ch. 3; [three.js docs](https://threejs.org/docs/). Reuses ML 2.4's 400 instances in one call.
- **Open:** none; foldable into 8.14.

### 8.16 Partículas, billboards y efectos (C)

- **Question:** ¿Cómo se hacen chispas, humo, niebla y brillo?
- **Before:** 8.4, 8.15, 4.14 (the object pool).
- **Leads:** RTR 13.6 (billboards), 13.8 (particles), 12.1–12.5 (post-processing, separable blur, bloom), 14.2.1 (fog),
  15.1–15.2 (toon, outlines); L2 §10.1–10.3 (decals, billboards, soft particles), §8.5 (fog as transmittance and
  inscattering). **Also:** MF §4.2–4.4 (fireworks: types, fuse, payload); GPP ch. 19, ch. 17.
- **Approach:** each effect is a cheap lie with a model behind it. Hook: a lamp breaks (6.11): sparks, glass and smoke; the
  coins should shine; the hall needs fog.
- **The mathematics:** billboards: a fixed vector and an approximate up (not parallel to it) give a basis by two cross
  products (1.6, 1.16); screen-aligned, viewpoint-oriented (no stretching at a wide field of view), axial (degenerate
  when the axis is the view). Particles: semi-implicit Euler (2.2) in the view, seeded from the event's seed but outside
  the hash (6.10's rule); a pool packed by swapping with the last; additive blending needs no sort (8.4's proof). Fog,
  with σ the same everywhere (a uniform fog): _dT_/_dd_ = −σ*T* gives _T_ = e^(−σ*d*), the 2.3 equation in distance;
  integrating the light scattered in, the same at every point of the ray, gives
  **c** = _T_**c**surface + (1 − _T_)**c**fog. Blur: _G_(_x_, _y_) = _g_(_x_)_g_(_y_), two 1D passes, *k*² → 2*k* taps (81 → 18 at
  _k_ = 9). Bloom: threshold the linear HDR image, blur, add, then tone map and encode last (`OutputPass`). **Example:** at
  σ = 0.1 m⁻¹: at 10 m Beer–Lambert gives 0.368, three.js's `FogExp2` (exp(−(ρ*d*)²)) also 0.368, the logic's rational
  1/(1 + σ*d*) 0.5; at 20 m: 0.135, 0.018, 0.333.
- **Depth:** Proved: the billboard basis and its degenerate case, Beer–Lambert and the inscattering formula for a
  uniform fog, the separable blur and its cost, additive's order-freedom (8.4). Stated: bloom as an imitation of glare,
  a recipe with no theorem behind it (RTR 12). Named: scattering in non-uniform media (radiative transfer, phase
  functions; RTR 14). Toy first: the logic's fog law and the pool by hand; three.js's fogs are measured against them.
- **The live figure:** a ring of billboards at a wide field of view, by alignment mode (RTR fig. 13.7); a spark emitter with
  pool size and allocations per second (toggle naive: `new` per spark, the GC sawtooth in the memory graph); fog curves
  (Beer–Lambert, `Fog`, `FogExp2`, the logic's) with a density slider and the room drawn with each; bloom with a threshold
  and an order switch (before the tone curve, or after the encoding: wrong). Panel: _T_ for each law at the player's
  distance, drawn minus logic, live particles, allocations.
- **Traps:** three.js's `Fog` is smoothstep(near, far, depth), not linear, and both fogs use view depth, not distance, so
  turning the camera changes an edge object's fog; soft particles need the depth; sort smoke, not sparks; a pool sized from
  rate × life.
- **Exercises:** (1) Derive the inscattering formula. (2) Prove the separable blur and its cost. (3) A firework type whose
  payload spawns children (MF Project 4.1): the pool size. (4) An axial billboard's basis and its degenerate case.
- **Our angle:** "one exponential for time and distance" (2.3 and fog); pools from 4.14. En Manifold: debris lives in a
  physics world of its own, seeded by the break, which nobody hashes (`debris.ts`); its fog is the simulation's, rational,
  "no `exp`" (`world.ts`).
  En Manifold (stage 5g): the weapons' feel, all view: a flash at the muzzle, sparks where a shot struck, a blast's
  ball of light growing to most of its radius, the view's kick for one's own shots eased back with a time constant of
  0.09 s (`presentation/src/fire.ts`).
- **Sources:** RTR 12.1–12.5, 13.6, 13.8, 14.2.1, 15.1–15.2; L2 §8.5, §10.1–10.3; MF §4.2–4.4; GPP ch. 17, ch. 19. Reuses
  ML 2.5's pooled particles and inverted-hull outlines, and archived 3-02's breaks through 6.11.
- **Open:** the drawn fog must be the logic's law (problem 3).
- **Para quien ya sabe** (curriculum §4.3): particles only drawn, never hashed: README decision 6.

### 8.17 El juego: la sala de noche (P)

- **Question:** ¿Cómo se juega la sala cuando la sombra que ves es la que te esconde?
- **Before:** 8.13, 8.14, 8.16 (and 7.14).
- **Leads:** the part sheet's game. **Also:** RTR 18 (pipeline optimization), G §10.8 (profiling).
- **Approach:** hook: 6.16's room in daylight lets the player see everything the guard cannot; at night the drawing becomes
  the information, so it must be true.
- **The project:** `instances.ts`'s `InstanceSet` draws coins and debris, one `InstancedMesh` per cell of 3.12's grid, so
  culling works and bounds stay correct (recomputed when a cell changes); `cull.ts` computes the frustum's planes for
  `show.cull` and the cell test; `particles.ts`'s `ParticlePool` (sparks, glass, dust); `fog.ts`'s `withLogicFog` patches the
  standard materials (`onBeforeCompile`) with the logic's transmittance; `post.ts`'s `createPost` (render pass with MSAA
  samples, bloom, `OutputPass`); the lantern is a shadowed spot attached to the guard's head; `view.quality` (pixel ratio,
  shadow size, bloom) per machine. The budget: 16.7 ms, at most four shadowed spots at 1024², pixel ratio 1, under 150 draw
  calls. Console: `show.frame`, `view.quality low`, `show.agreement`. Recipes: `seed 5; restart; step 1800; hash` equal with
  `view.quality low` and `high`; `show.agreement` at least 98%; `renderer.info` calls under 150.
- **Depth:** No new theorem: the part's results applied. Measured, not proved: the frame budget, the 98% agreement
  (problem 7), the hash unchanged by every view setting. Named: a portal through the doorway (exercise 2, 10.7).
- **Traps:** the lantern's shadow swimming (snap or accept); bloom hiding the dark the player needs (threshold above the
  meter's range); GPU memory leaked on restart (6.2's disposal).
- **Exercises:** (1) Add a second guard's lantern within the budget. (2) A "Más a fondo": draw the room's other side
  through a doorway portal (10.7). (3) Beat your ghost at night.
- **Our angle:** the part's thesis: the drawing shows what the simulation knows, measured. The game's hash ignores every
  view setting.
  En Manifold (stages 5a, 5f): a sky drawn from the hour (`skyAt`: its hue from the hour, its strength from the
  ambient), and the fortress at 22 h with an ambient of 0.12 and its lanterns.
- **Sources:** RTR 18; G §10.8.
- **Open:** whether 6.16's lamps are spots (one depth pass each) or points (six); the budget assumes spots (problem 8).

---

## Problems found in the curriculum (kept as approved)

1. **8.7 depends on part 6's falloff.** "Lamps … so that 6.8's meter and the drawn light agree" holds exactly only if
   6.8's windowed falloff is three.js's (decay 2, the (1 − (_d_/_r_)⁴)² window, the 0.01 clamp) and its spot factor is
   three.js's smoothstep of cosines. Both are exactly rounded (× and ÷ only), so 2.9's rule allows them. 6.8's sheet must
   choose them, and say which normal the meter uses.
2. **`PCFSoftShadowMap` no longer exists in three.js 0.187** (it warns and falls back to `PCFShadowMap`). The RTR reader's
   mapping, and older tutorials, are outdated; soft edges come from `shadow.radius` or VSM.
3. **Fog.** three.js's `Fog` is a smoothstep and `FogExp2` a Gaussian, both on view depth; neither is Beer–Lambert, nor the
   simulation's rational transmittance (Manifold's choice under the same rule as 2.9). For "drawn = logic" (8.17), the
   drawn fog needs a shader chunk.
4. **WebGL or WebGPU.** three.js 0.187 ships `WebGPURenderer` (TSL, NDC depth in [0, 1]). Part 8's derivations and shaders
   assume `WebGLRenderer` and GLSL; the choice deserves a decision record before part 8 is written.
5. **8.4 cannot blend in linear yet.** On the canvas three.js blends sRGB-encoded values; linear blending needs the linear
   render target of 8.16's post chain, so 8.4 can only point forward.
6. **The "what transforms how" table** lacks the tangent (8.10): a direction under **M**, carrying a handedness σ that
   flips with det < 0.
7. **"The same who sees whom" is an agreement, not an identity** (8.17): shadow maps are sampled (texels, bias) and the
   logic's rays are exact, and PCF softens edges the logic draws hard. The curriculum should accept a measured agreement
   (the sheets propose at least 98% of floor samples).
8. **The integrated-GPU budget constrains part 6.** A shadowed point light costs six depth passes; the night room fits the
   budget with spot lamps, so 6.16 should give its lamps cones (which 6.8 already teaches).

### Depth review (2026-11-18)

What the rule of curriculum §4.6 could not settle alone:

1. **A proof outside §3's books.** RTR 5.4 states the sampling theorem without proof, and no book in §3 proves it.
   8.9's Depth line points to _Physically Based Rendering_, 4th ed. (free online), §8.1; the author may prefer another
   source, or only a "Para saber más".
2. **The toys for physical materials and shadows.** 8.5 builds Lambert by hand and compares it with three.js pixel by
   pixel. 8.11 and 8.12 only reuse ML 2.3's hand-written Cook–Torrance and ML 2.4's two-pass shadow map (in their
   sources). Should each be a main-path rung read against `MeshStandardMaterial` and `LightShadow`, as the rule asks,
   or does 8.5's toy cover shading for the part? PMREM's prefiltering stays stated either way.
3. **The normal offset is level 1 and unwritten.** 8.13's `normalBiasFor` gives "8.12's bias from the texel size", but
   8.12 derives only the depth bias ½·texel·tan θ. Moving the lookup δ along the normal puts it δ/cos θ in front of the
   surface along the light, so δ > ½·texel·sin θ suffices: half a texel works at every angle, where the depth bias grows
   without bound. The game asks for a bias that does not fail; prove it in 8.12, or leave it stated?
4. **8.12's example and a spot's depth.** A spot's map stores depth along its axis, so a floor square to a downward
   spot has one depth across each texel and needs no slope term. "At θ = 45° the bias needs about 3 mm" fits a surface
   tilted 45° from that axis (or the sun's map), not the floor at the cone's edge. Which was meant?
