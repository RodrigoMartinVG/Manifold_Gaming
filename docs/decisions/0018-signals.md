# 0018. Signals: named values, once per step, in the order written

- **Status:** accepted
- **Date:** 2026-11-15

## Context

Phase 3's world responds: a button opens a door, a plate calls an elevator, and in phase 4 a guard will hear a door and a navigation graph will ask whether it is open. Something has to carry "the button was pressed" to "the door opens", and the roadmap asked for a decision first: **what a signal is (a value or an event), when it is read, and in what order**. Whatever it is must hold what every system here holds:

- **Determinism:** the same inputs, the same world, in Chromium, Firefox, WebKit and Node (decision 0012).
- **State as data** (decision 0004): a snapshot restores it, a replay plays it, the hash sees it. Nothing pending outside the world.
- **The networking model** (decision 0016): the server's world is the truth, and every copy runs the same steps.
- **Mechanism and policy** (decision 0000): the engine moves doors; what a zone means is the game's.
- **Inspectable:** the console says what each signal is and what it reads (decision 0010), and the level says it in text (stage 2a).

V1 had mechanisms and logic signals; the drafts proposed "a simple graph in the state: a sensor or a button emits `open`, `toggle` or `trigger`, and the door changes at the next step". Engines answer this question in two ways. **Events** (Source's inputs and outputs, Doom's targets, Unreal's events): something fires, a message travels, the receiver reacts once. **Values** (Factorio's circuits, Minecraft's redstone): a wire holds a number on every tick, and whoever reads it sees what it is now.

## Decision

### A signal is a value

A **signal** is a named number in the world: 0 is off, anything else is on (most are 0 or 1; a plate counts how many are on it). It has a value at every step, kept with the rest of the world's state: hashed, in snapshots, played by replays. A mechanism reads it as a **level**: a door is open while its signal is on, not "when it was opened".

An event is what a change of value is: when a signal changes, the world emits `signalChanged` (its name, the value, the one before). Whoever wants edges (a sound, phase 4's guard, the drawing) reads those; nothing in the simulation depends on having seen one, so an event lost in the drawing (two steps in one frame) changes nothing.

### What a signal is made of: what the level says

Every signal a level uses is declared in it, one per line, by name, with what it is computed from:

```
signal plate_on   zone plate          how many are in the zone named plate
signal pressed    used button         1 on the step a character pressed `use` in the zone named button
signal gate       toggle pressed      flips each time `pressed` turns on
signal lift_up    latch call_top call_bottom    on when the first turns on, off when the second does
signal both       all a b             on while every one is on (any: while one is; not: the opposite)
signal lights                         an input: the game or the console sets it
```

The sources are zones, through what any zone knows without reading its kind (decision 0000's rule holds): **who is in it** (`zone`: the characters and the bodies the physics moves, not what the program moves, so a lift passing through a plate does not press it) and **who used it** this step (`used`: a character that pressed `use`, a new action of the core's, with its center in it). The rest is logic over signals: `any`, `all`, `not`, `toggle`, `latch`. A signal with nothing after its name is an **input**: the game writes it (`World.setSignal`, in its hooks) or the console does (`signal lights 1`, a world change at a step, in the replay). Computed signals cannot be written: they would be overwritten at the next step, silently.

### When: once per step, at its end

The step gets one more phase, **signals**, after the zones: every signal is computed from what the zones noticed in that step. Mechanisms read them at the start of the next step, when kinematic bodies get their velocity. **From a cause to its effect there is always exactly one step** (a plate pressed at step N moves its door from step N + 1), whatever the chain of logic in between.

### In what order: the order written

Signals are computed in the order the level declares them, and **a signal reads only zones and signals declared above it**. So the computation is one pass, its result does not depend on which entity happens to come first, and a cycle (a signal that depends on itself) cannot be written: the reader refuses it, with its line. What is pending from one step to the next is in the signals themselves (`toggle` and `latch` keep their value, and `toggle` the value of what it reads at the step before), so a snapshot restores them exactly.

### Mechanisms: a place that is a function of its state and the step

A **mechanism** is a kinematic body (decision 0000: a door that is moved has to push) that goes between two places at a speed, driven by a signal: a **door** turns around its hinge, a **lift** moves along a line. A door's place and turn at every step come from its hinge (its slab's center goes round it), so its body, centered on the slab, collides and is drawn as any box is, and what draws it needs no pivot of its own. It keeps only data: its signal, how long it takes, which way it is going, and the step and the place where it last changed direction. Where it is, at any step, is a function of that and the step, as a moving platform's is (stage 2d): it does not drift, it rewinds, and Node puts it in the same place. A signal that changes halfway turns it back from where it is. A character stands on a lift as on a platform (stage 3a's ground and carry).

### What the engine does not do

It does not interpret a zone's kind, choose what presses a button besides `use`, or give a signal a meaning: the game decides what its zones are, which of its rules set input signals, and what a sound or a guard does with an edge. It does not delay signals by more than the one step, and it has no timers yet: a door that closes by itself after a while is a game rule today, and a `delay` operator when a level asks for one.

## Consequences

- **Good:** a signal is one more piece of the world's data: snapshots, replays, the hash and the network carry it with nothing new, and a rewind puts every door where it was.
- **Good:** the order is the level's text, read top to bottom; the console can say, for every signal, its value, what it reads and what reads it (`signal`, and `show.signals` draws it).
- **Good:** phase 4 reads the same values: a guard asks whether a door is open, a navigation graph asks whether a lift is up, without listening to anything.
- **Costs:** one step of delay, always, also where a game would want none (a plate and its door, in the same step, are one step apart: 17 ms). And a level that wants the same logic twice writes it twice: there are no reusable pieces (prefabs) yet.
- **Rule:** a signal is declared before it is read, and a computed one is never written; both are errors of the level, with their line.

## Alternatives discarded

- **Events that travel between entities** (an output fires an input, maybe with a delay): the order in which they are delivered becomes part of the world, a queue of events pending between steps has to go into snapshots, a rewind has to know which were already delivered, and a door that missed an event stays wrong for good. With values, a door that missed nothing can be wrong only for one step.
- **Entities calling each other** (a button that "uses" a door): it ties every producer to its consumers in code, and nothing in the world says why a door opened.
- **Computing every signal until nothing changes** (a fixed point inside the step): a cycle never settles, and the number of passes depends on the level.
- **One step of delay per hop, as Factorio does:** simple, and the order does not matter; but a chain of five pieces of logic takes five steps, and the author has to count them. Reading only what is declared above gives the same safety in one step.
- **Signals as a game's components:** every game would write its own, and a level could not declare them.
