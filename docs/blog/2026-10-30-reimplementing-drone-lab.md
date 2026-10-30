# Re-implementing Drone Lab: what building 13 interactive drones taught us

*2026-10-30*

[Drone Lab](https://github.com/kanishka-namdeo/build-a-drone) is a browser workshop where you design, build, and then fly thirteen drones — a 65 mm whoop to a 15 kg cinema octocopter. This post is about the re-implementation: what the architecture looks like, and the bugs that only appeared when we flew the thing like a user would.

## The shape of the app

The original (drone-engineer.vercel.app) is a single 500 KB HTML file: an isometric hand-inked drawing engine, a workshop state machine, a flight simulator, and thirteen drone definitions, all inline. We re-implemented the whole interaction design from scratch in TypeScript — no framework, no runtime dependencies, just DOM + SVG + WebAudio — but split into four layers that can actually be tested:

```
engine    projection, primitives, ink filter, page shell, audio, storage
workshop  the bench: parts, polarity mistakes, safety tests, calculator
flight    physics, world/collision, third-person + FPV renderers, controls
crafts    13 data records: catalogue, parts, drawing, wiring, quiz, range
```

The whole trick is the last layer. A drone is *data*: battery/motor/prop tables with grams and dollars, a build order with deliberately polarised parts, a drawing function, a wiring map, and the flying world. The engine never special-cases a craft — all the weird stuff (a servo that tilts a tail motor, a winch that drops a parcel and changes the mass, tilt nacelles) rides through the same hooks.

## The pedagogy is the product

The bench enforces the rules that keep fingers attached. Props go on **last** — the engine literally refuses to fit them until you have run the smoke-stopper test and the motor direction check. One motor always spins the wrong way until the check fixes it. Fit the flight controller backwards and the quad flips on take-off. Reverse the capacitor and it vents with a pop on first plug-in — unless the smoke stopper caught it first.

The best part: the flight simulator uses the numbers from the parts you picked. A 6S 1800 pack makes the quad heavier and the hover throttle higher; a 2450 KV motor on 6S overheats and desyncs mid-air, exactly as the calculator warned.

## Bugs only a user finds

We flow-tested the app in a real browser, screenshots reviewed by a vision model, then locked everything in Playwright. The e2e suite caught five real bugs that unit tests and code review had missed:

1. **The select labels were never attached.** The design-bench dropdowns were created inside a `<label>` wrapper — and then the code appended the *select*, not the wrapper. The labels existed in memory and nowhere else.
2. **Quiz persistence never loaded back.** Answers were saved to localStorage on click and hydrating them at mount was... written in a patch that silently didn't apply. The test that reloaded the page found it.
3. **Design changes didn't re-render.** Changing the battery updated the model but nobody called render — the calculator sat there showing stale numbers until the next unrelated action.
4. **Parts got stuck at t=0.** The animation driver only woke up for parts with `t > 0`, and freshly placed parts have exactly `t = 0`. They hovered invisibly one frame above the mat forever. A fast test client (clicks with no human delay) made it deterministic.
5. **Every popover open leaked a stale copy.** The part picker appended a new dropdown each time without removing the hidden old one — fine for humans, poison for automation, and a real DOM leak.

And two physics bugs that the *numbers* caught: an up-vector formula that made a level quad accelerate backwards at 14 m/s, and a flying wing whose lift acted along the body axis — which can do work along the velocity, so the wing created energy out of nothing and hit 94,756 m/s before NaN-ing out. Aerodynamic lift acts perpendicular to the relative wind; the day that clicked, the wing stopped exploding and started phugoiding like a real foamie.

## Try it

```bash
npm install && npm run dev
```

Fly the living room in a whoop, cut the link on a long-ranger and watch GPS Rescue bring it home, transition a tiltrotor through the stall, kill a motor on the octo and land on seven. The mistakes are the curriculum.
