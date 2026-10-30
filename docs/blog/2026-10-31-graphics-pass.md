# The graphics pass: giving Drone Lab weather, weight, and a lens

*2026-10-31*

v1.0.0 shipped a complete simulator wrapped in an illustration style that was, honestly, a
little too polite. The figures were flat three-tone vector shapes on a cutting mat that
floated on the paper; the flight view was a grid in a void; the FPV view was a rectangle
with text on it. So we spent a pass doing nothing but making it *look* like the thing it
pretends to be. v1.1.0 is that pass.

## The rule: everything cheap, nothing filtered

The whole app re-renders its SVG scene as a string every frame during flight. That rules
out the fun stuff — no per-face `feGaussianBlur`, no drop-shadow filters on moving objects.
Everything in the new `engine/vfx.ts` is flat fills, strokes, and **shared gradients
referenced from tiny defs**, deduplicated per render pass by a `vfxDefOnce(id)` helper the
shell resets on every `render()`. Heavy detail (grass tufts, mow stripes, floorboards) is
generated once per world and cached as a string. The result holds 60 fps with clouds,
shadows and haze in the scene.

## Shading: from three tones to a ramp

The old `tone()` picked one of three flat colours per face. The new one expands every
material into an **8-band cel ramp** where the dark end drifts toward indigo and the light
end toward warm cream — the way ink illustrators actually shade — with a specular cap band
for sheen. Ramps are memoised per material, so the cost is one `Map` lookup. Cylinders and
lofts went from "three stripes" to "actually round".

Shadows lost their hard edges too: each cast shadow is now a hull filled with one shared
linear gradient, dark at the object's base and fading to nothing at the tip — a soft shadow
with zero filters. On the bench, the mat grid now draws *through* the shadow, and motors
get contact-AO discs so the craft finally sits on the mat instead of hovering over it.

## The flight world got weather

- A **sky band** behind the field: two layers of hazy hills, a sun with a glow, drifting
  cumulus, and a couple of birds.
- **Cloud shadows** crawl across the grass in sync with the clouds above.
- **Aerial perspective**: distant solids and far ground fade toward the haze colour.
- The ground itself: mow stripes, a hundred seeded grass tufts leaning with the light, a
  few flowers; trees got lumpy broccoli canopies instead of perfect cones; race pylons got
  base plates and **fluttering pennants** so they stop reading like debug markers.
- The craft now casts an **altitude-softened shadow** on the ground — sharp and dark when
  you're low, wide and pale when you're high — and stirs expanding **downwash rings** when
  you hover close to the grass.

## Indoors is indoors

The Tiny Whoop flies a living room. Giving it an outdoor sky was wrong, so ranges can now
declare `indoor: true` and get a warm wall with faint wallpaper stripes, framed pictures,
floorboards instead of grass, and a warm ceiling in FPV. No clouds in your living room.

## FPV got a lens

The goggles view now has a gradient sky, world-anchored clouds that parallax properly, a
sun positioned from the actual light vector, layered hazy hills, and a horizon fog band.
Over the feed: a vignette, a whisper of scanlines, and the props in the corners are
gradient blur discs with streak arcs instead of flat white circles.

## The part where the users found the bugs

The first build of this pass crashed every page with
`Cannot read properties of undefined (reading 'replace')` — because some craft code passes
partial material objects, and the old three-tone `tone()` happened to never touch the
missing field on lit faces. The new ramp always reads all three. Lesson repeated for the
hundredth time: **your renderer's input contract is whatever the sloppiest caller sends.**
A vision-model review of before/after screenshots caught the rest: shadows that hid the
grid, "debug-red" pylons, the empty white void above the indoor room. Two rounds later it
scored the set 8.5/10 and called it shippable.

All 38 unit tests and 10 Playwright flows still pass; the media in the README (13 craft
shots, the hero, the flight demo video) was re-captured on the new renderer — including
`craft-quad5.png`, which the README had linked since day one without ever shipping.
