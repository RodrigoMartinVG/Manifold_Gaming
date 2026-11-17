# 0022. Hits and the history of poses: every copy keeps each character's last quarter of a second, and a shot looks back as far as its shooter saw

- **Status:** accepted
- **Date:** 2026-11-16

## Context

Stage 4c brings health, damage and weapons. Decision [0016](0016-the-networking-model.md) already said how hits are judged online: the others are seen in the past (at the last confirmed step), so a shot is judged against **where they were when the shooter saw them**, from a history of the characters' poses, looking back **at most 200 to 250 ms**. It also said phase 4 builds that history before phase 6 needs it. Before any code, four things with a long tail must be settled: what a pose is, where the history lives, how far back a shot looks and who says how far, and how a hit reaches each copy. Each one touches the input format, the hash, the snapshots or the replays.

What there is to build on:

- **The characters' bodies by mode are data** (stage 2e: `poses`, `poseOf`), and since 4b the controller moves the low one while crouching or rolling. The view's procedural layers (4a: the IK, the hands, the aim) reach nothing of the hash.
- **The server orders the inputs and every copy simulates them** (0016); replays are the confirmed inputs; a snapshot carries the whole state.
- **The world's randomness is seeded** and part of the state (`Random`, decision 0004).

## Decision

### A pose is plain data, and its hit shapes come from the character's data

- **A pose** is what a character is at the end of a step: where it is, its body's turn (where it looks, flat about its up), its pitch (4b) and its mode. Four fields, plain data; everything a hit needs comes from them, in Node, without the models.
- **Its hit shapes:** for each mode, two or three named parts (`head`, `body`, `legs`), each a shape with an offset and a turn in the character's frame, given by the game like its `poses` are (`hits`, by mode). A game that gives none has one part, `body`: its collision pose. The games' character gives three for standing, crouched and rolling, in the air and gliding. The head part does not follow the pitch: the aim tilts the head by a few centimeters, less than the part's size.

### The history lives in the world: each character's last 16 poses

- Every character keeps a ring of its **last 16 poses**: this step's and the 15 before, a quarter of a second at 60 steps a second. It is written at the end of each step, once the physics has moved everything (a phase after `readBack`).
- **It is part of the state:** a component, in the hash and in the snapshots, so a world restored from a snapshot (joining a match already started, `step back` in 4e) judges a shot exactly as the world it came from. Kept outside the world (by the session, or only by the server), a snapshot would arrive without it, and a replay would judge the shots of its first quarter second differently.

### A shot says how far back its shooter saw, and the simulation looks back that far

- **A shot's input carries `back`:** how many whole steps behind the present the shooter was seeing the others, from 0 to 15. It needs a new kind of input, `count` (a whole number from 0 to a maximum the action declares), because it is neither an axis nor a vector; a replay writes it as the number.
- **Who says it:** today, with no latency, it is 0. In phase 6 the server fills it in from what it measures of each player (which confirmed step that player was showing when its input arrived), never from the client's word alone. Beyond 15, 15: whoever plays with more latency aims ahead, instead of everyone else being hit behind cover (0016).
- **The simulation resolves a shot at the step it enters:** a ray (hitscan) or a swept volume (melee, the swept hit volumes decision 0000 took) against the characters' hit shapes **as their history had them `back` steps ago**, and against everything else as it is now. Only the targets' poses go back, never the world (0000 and 0016 ruled that out).
- **Projectiles do not look back:** they live in the present, a segment of ray per step (so nothing is crossed between steps), and hit what is there when they get there. Their shooter's latency shows as part of their flight, as in the games that have them.
- **Whole steps:** the page draws the others between two steps, and a shot taken between them is judged at the nearer step. The error is half a step at most (8 ms: 4 cm at 5 m/s), less than a hit shape; not worth another field in every shot.

### A hit is not told: every copy simulates it

- Every copy simulates the same inputs against the same history, so **a hit is an event of the step** (`hit`: who, whom, which part, how much), the same on every copy and in every replay. The server sends no message about hits.
- **The shooter's page may guess at once**, in the view only: a marker where it thinks it hit. The target reacts when the step is confirmed, on every copy alike; if the confirmed step says otherwise, the marker was a guess.
- **The spread comes from its own dice:** a generator seeded by the world's seed, the step, the player and the shot's number in that step, not drawn from the world's randomness. Another shot in the same step, or something new that draws numbers, does not change it.

### What it leaves open, on purpose

- **How the server measures each player's `back`**: phase 6, with its server.
- **What the physics moves** (a crate, a ball) is hit as it is now: a body of the physics has no history.
- **Health, damage, dying and coming back, and each game's filter**: 4c's code, as components and a hook of each game (0000 took the hook).

## Consequences

- **Good:** when phase 6 arrives, lag compensation is already in the simulation: `back` stops being 0, and nothing else changes.
- **Good:** nothing of the model changes: a shot is an input, its hit is simulated everywhere, and replays, ghosts and the hash work as they do.
- **Costs:** 16 poses of about nine numbers for each character, in the state and the hash at every step: a few hundred bytes a character in a snapshot. 4c measures it.
- **Costs:** a target can be hit after it has ducked behind cover on its own screen (the "shot around the corner"), the price of every shooter that looks back, capped at a quarter of a second.
- **Costs:** the input format gets a new kind, `count`.

## Alternatives discarded

- **The history only on the server, and hits sent as messages:** it breaks 0016 (the server sends inputs, not results), and a replay would need the messages to play its shots.
- **Not looking back:** every shooter would aim ahead by their own latency; with hitscan, past 50 ms it stops being playable.
- **Rolling the whole world back:** ruled out by 0000 and 0016, with measurements.
- **Hit shapes from the animated bones:** the models and the procedural layers would have to run in Node, with their arithmetic, in the hash; two or three shapes per mode are what a compact shooter needs (decision 0017).
- **Looking back between steps:** one more field in every shot for 8 ms at most.
- **Trusting the client's `back` without a cap:** whoever claims more latency would get more of the past.
