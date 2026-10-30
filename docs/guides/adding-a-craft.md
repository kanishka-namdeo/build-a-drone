# Adding a craft

A craft is one file in `src/crafts/` exporting a `CraftRecord` (see `src/types.ts`). `quad5.ts` (Fig. 01) is the reference implementation — copy its structure. This guide is the contract.

## 1. Identity + catalogue

```ts
export const myCraft: CraftRecord = {
  key: 'mycraft',          // hash route, unique
  fig: 6,                  // figure number (roster order)
  name: 'GPS camera drone',
  sub: 'ArduPilot, gimbal',// one-liner for the roster
  palette: 'mint',         // mustard | tomato | mint | cobalt | blush
  log: 'ardupilot',        // betaflight | ardupilot | inav | crazyflie | mavsdk
  mat: 420,                // bench cutting-mat size in mm (craft must fit)
  benchH: 260,             // bench scene bbox height (mm) for framing
  flyScale: 2.2,           // draw scale in flight (bigger craft -> smaller)
  flyVB: 12000,            // flight view width in px (1000 px per metre)
  kThrust: 1.06,           // grams of thrust per motor at krpm^2 (calibrate!)
  gPerW: 9,                // hover grams per watt
  minTW: 2,                // "weak build" threshold
  design: { batt: 'b1', motor: 'm1', prop: 'p1' },
  batts:  { b1: { name: '4S 5000', cells: 4, mah: 5000, g: 500, price: 55, col: '#2b2a28', lab: '4S 5000' }, ... },
  motors: { m1: { name: '2212 920KV', kv: 920, g: 58, price: 18 }, ... },
  props:  { p1: { name: '10x4.5', pf: 1, eff: 1, g: 13, price: 8 }, ... },
  fixed:  [ { id: 'FRAME', name: 'F450 frame', g: 270, price: 35, cat: 'Mechanical' }, ... ],
  ...
```

Calibrate `kThrust` so the default design produces believable thrust (target T:W, hover watts and flight time). Worked example: thrust per motor ≈ `kThrust * pf * (kv * cells * 3.7 / 1000)^2` grams.

## 2. Parts + motor map

`parts[]` drives the bench build. Use the canonical ids the engine tests key off — `FRAME MOTORS ESC WIRES FC XT60 CAM RX VTX TOP BATT PROPS` — plus any craft-specific ones (`GPS`, `GIMBAL`, `SERVO`, `MAST`, ...). Each part:

```ts
{ id: 'FC', name: 'Pixhawk 6C', short: 'FLIGHT CTRL', z: 3,
  after: ['ESC'],                       // prerequisites (part ids)
  polar: ['arrow forward', 'arrow backward'],  // optional: [correct, mistake]
  what: 'Teaching blurb shown when selected.' }
```

- `z` = explode layer (later parts higher).
- Polar parts can be flipped via "Add next part" — orient 1 is the mistake that bites in flight (`FC`, `XT60`, `PROPS` are engine-recognised).
- `PROPS` must be last-ish; the engine blocks adding props before the smoke-stopper + motor tests (set `noSmoke: true` on 1S crafts).
- `mpos`: `[[x, y, 'M1', 'CW'], ...]` in mm, craft-local (+x nose, +y left). `wrongMotor: 3` makes M3 spin backwards until the motor test fixes it.
- `calLabel`: rename the calibrate button if the firmware calls it differently (e.g. 'Calibrate accelerometer + compass').

## 3. Drawing

`draw(f, add, opt)` renders the craft in its own frame `f` (origin at centre-bottom, +x nose, z up, millimetres):

```ts
draw(f, add, opt) {
  if (opt.has('FRAME')) {
    const F = opt.U('FRAME');                 // lifted for drop/explode
    add([0, 0, 0], obox(F, -56, 56, -23, 23, -3, 0, CARBON).svg, 'FRAME');
  }
  ...
}
```

- Wrap every part in `if (opt.has(id))` and use `opt.U(id)` as its frame.
- `add(at, svg, id)` registers a depth-sorted piece; `at` is its centre; `id` makes it clickable.
- `opt.orient(id)` = 1 when a polar part is flipped — flip the arrow/stripe/prop direction.
- `opt.spin[i]` = motor spin phase (bench tests); `opt.rpm[i]` = 0..1 in flight (draw blur discs when > 0.12).
- `opt.power` → LEDs + glow dots; `opt.fault` → burnt capacitor; `opt.broken` → skip props; `opt.design` → battery colour/label follows the selection.
- Solids: `obox` (boxes), `ocyl` (cylinders, taper via r1), `odisc`, `otext`, `tube` (wires), `rod3`, `glowDot`. Materials from `engine/materials` or `matOf('#hex')`, plus the palette `opt.m`.
- Keep every part under ~40 lines of drawing code; favour a few well-shaped solids over many tiny ones.
- `hull(f)` returns cast-shadow points (extremities are enough).
- `tags`: `[[id, [x,y,z], dx, dy], ...]` — callout pills; dx/dy are screen offsets.

## 4. Wiring

```ts
wiring: {
  nodes(d, c) { return {
    BATT:  [20, 238, 'BATTERY', '4S 5000', '#e2483d'],   // x, y, title, sub, tab colour
    FC:    [360, 70, 'PIXHAWK', '6C, ArduPilot', '#3e86d9'], ... } },
  links: [
    { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
    { from: 'FC', to: 'GPS', kind: 'i2c', label: 'GPS + compass' }, ... ] }
```

Canvas is 760 × 340; node boxes are 150 × 56. Kinds: `power` (red+black pair), `data` (green dashed), `video` (yellow), `motor` (orange triple), `rf` (purple), `i2c` (blue). Node ids should match part ids where sensible (clicks sync selection with the bench).

## 5. Lesson content

- `overview`: 2-3 short HTML paragraphs — what this drone is for, what's special, why.
- `buildCode`: the real firmware CLI/params for this build (Betaflight / ArduPilot `param set` / INAV / cflib / MAVSDK). Mode snippets come from `modes`.
- `cliName` / `logName`: e.g. 'ArduPilot', 'MAVSDK-Python'.
- `quiz`: 4 questions `{ q, a: [3-4 options], ok }` teaching this page's core lessons.
- `practice`: one sentence exercise.
- `controls`: optional custom `[[key, action]]` list (default is the quad one).

## 6. Flight

Default modes: `alt`, `angle`, `acro`, `race`. Add craft modes via `modes: { ... }` and pick `mode: 'loiter'`. A `range` gives a 5th mode with checkpoints:

```ts
range: {
  title: 'Roof inspection', brief: 'One-liner shown at run start.',
  field: 40, pad: [20, 6], ground: '#dde3cc',
  keepGates: false,                 // true to keep the 5 race gates too
  prims: [ { t: 'house', x: 24, y: 14, w: 8, d: 10, h: 5 },
           { t: 'tree', x: 8, y: 30, h: 6 },
           { t: 'flat', x: 24, y: 14, w: 6, d: 8, col: '#c9c4b4', label: 'ROOF' } ],
  goals: [ { x: 24, y: 14, z: 6.5, r: 1.2, label: 'ROOF TOP' },
           { x: 20, y: 6, z: 0.8, r: 1.6, label: 'LAND' } ] }
```

Prims: `box` (x,y,z?,w,d,h,yaw?,col?), `cyl` (x,y,z?,r,h,r1?,n?,rot?,col?), `tree` (x,y,h), `pole` (x,y,h), `gate` (x,y,heading,w?,h?), `house` (box+pyramid roof), `flat` (ground rect, label), `disc` (ground circle, label). Goals: rings need `heading` (degrees you must cross flying); spheres omit it.

Hooks for unique behaviour: `calc(d)` (custom model), `warnings(d, c)` (extra warnings), `physics(fl, dt, ctx)` (replace the flight model — call `ctx.stock(fl, dt)` for the multirotor step after setting `ctx.stick` as an autopilot), `flyStats(fl)` (extra HUD tiles), `calcRows(c)` (custom calculator tiles), `extraButtons` (`{ label, onClick(fl), inFlight }`).

## 7. Register

Add the file to `src/crafts/index.ts` imports + `crafts` array, and check the roster entry (already present for all 13).

## 8. Verify

```bash
npx tsc --noEmit && npm run build
npm run preview   # then load /#/craft-key, run: build -> tests -> plug -> fly each mode
```

Check: default calculator numbers are believable (T:W, minutes), the bench flow gates work, the craft fits the mat (`mat` big enough), flight is stable, range goals are reachable, quiz answers are correct.
