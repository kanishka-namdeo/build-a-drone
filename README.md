# Drone Lab — build a drone

**Hand-inked drones you design, build, and then fly.** An interactive FPV drone engineering workshop that runs entirely in your browser: pick parts and watch the thrust-to-weight math update, wire the stack, build it part by part on the bench, smoke-test it, check motor direction, calibrate, plug in — then fly it in a simulator that uses the mass and thrust you designed.

A ground-up, independent re-implementation of the interaction design of [drone-engineer.vercel.app](https://drone-engineer.vercel.app) (Drone Lab). Original code, zero runtime dependencies, installable as a PWA.

https://github.com/kanishka-namdeo/build-a-drone

## What's inside

- **13 hand-inked isometric drone figures** — from a 65 mm Tiny Whoop to a 12S heavy-lift octocopter — each drawn as live SVG with a wobbling "hand-inked" filter, cast shadows, and clickable part callouts.
- **A real workshop loop**: take it apart → add parts in order (polarised parts can be fitted *backwards* on purpose) → smoke-stopper test → motor direction check (one motor is deliberately wrong) → accelerometer calibration → plug in the battery. Make the classic mistakes and they bite: a reversed capacitor vents on plug-in, a backwards flight-controller arrow flips the quad on take-off.
- **A design bench calculator**: batteries × motors × props → all-up weight, thrust-to-weight, hover throttle, max current, hover and freestyle flight time, cost split. The simulator's physics uses your numbers.
- **Wiring diagram** with clickable, colour-coded blocks (power / data / video / motor phases).
- **A flight simulator**: altitude-hold, angle, acro, gate racing, and per-craft freestyle ranges. Third-person isometric view and an FPV goggles view with OSD (voltage, timer, altitude, speed, artificial horizon, navigation arrow).
- **Firmware-flavoured consoles**: Betaflight / ArduPilot / INAV CLI snippets and a serial log that narrates everything you do.
- **Check-yourself quizzes** with persisted answers, and a practice task per craft.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build + preview:

```bash
npm run build      # typecheck + bundle into dist/
npm run preview    # http://localhost:4173
```

Tests:

```bash
npm test           # unit (calculator, physics, storage, audio)
npm run test:e2e   # Playwright flows against the built app
```

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` | throttle (climb / descend in altitude-hold) |
| `A` / `D` | yaw |
| arrows | pitch + roll |
| `Space` | arm / disarm |
| `R` | reset to the pad |
| `V` | FPV view on / off |

On touch devices, drag the two on-screen sticks.

## The roster

| Fig | Craft | The lesson |
| --- | --- | --- |
| 01 | 5-inch freestyle quad | the default first FPV build |
| 02 | Tiny Whoop 65 mm | ducted indoor micro, 1S sag |
| 03 | 3-inch cinewhoop | ducts + a naked action cam |
| 04 | 7-inch long range | Li-ion + GPS Rescue failsafe |
| 05 | 5-inch racing quad | rates, gates, dive towers |
| 06 | GPS camera drone | ArduPilot, waypoints, gimbal |
| 07 | Delivery drone | companion computer + winch |
| 08 | Agri hexacopter | spray missions + RTK |
| 09 | FPV flying wing | elevons, stalls, hand launch |
| 10 | VTOL tiltrotor | hover ↔ cruise transitions |
| 11 | Swarm micro | Crazyflie decks + formations |
| 12 | Tricopter | tail-servo yaw |
| 13 | Heavy-lift octocopter | redundancy, motor-out |

## Architecture

Four layers, no framework — vanilla TypeScript + DOM + SVG + WebAudio:

```
src/engine    isometric drawing engine + page shell + audio + storage
src/workshop  bench state machine, calculator, wiring, lesson panels
src/flight    physics, world/collision, third-person + FPV renderers
src/crafts    13 data-driven drone definitions (CraftRecord)
```

Every drone is a data record: catalogue tables, build steps with polarity mistakes, drawing code, wiring map, quiz, and its flying range. The engine never special-cases a craft. See [docs/architecture.md](docs/architecture.md).

## Credits

- Interaction design inspiration: [Drone Lab](https://drone-engineer.vercel.app) (built with the Colorfigures skill).
- Drone facts are common FPV community knowledge (Betaflight/ArduPilot/INAV docs, vendor spec sheets).

## License

MIT — see [LICENSE](LICENSE).
