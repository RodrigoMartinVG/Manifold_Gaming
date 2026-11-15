# 0016. The networking model: one server orders the inputs, everyone simulates, and each predicts only its own character

- **Status:** accepted
- **Date:** 2026-11-15

## Context

Stage 1e built the networking skeleton, and everything already goes through it: even alone, a page plays through a server of its own. The server orders the inputs (each at a step), every copy simulates them (the simulation is deterministic: the same bits in Chromium, Firefox, WebKit and Node), and every second each copy compares its hash with the server's. Between tabs of the same browser there is no latency, and this is enough.

Phase 6 brings matches over the internet, with latency (tens to hundreds of milliseconds), for the shooter. Phase 4, before it, brings the pose history that lag compensation needs. Both need the model written down first. Decision [0000](0000-why-a-v2.md) already ruled out part of it, with measurements: rolling the whole world back with snapshots (in V1, 244 KB and 3 ms to restore one, more than a step; here, 571 KB in the stress room) is not the way; networking reconciles by re-simulating only one's own.

## Decision

### The server orders, everyone simulates

As today: the server is the truth about **which inputs entered at which step**. It does not send the world, it sends the inputs; every copy simulates them and gets the same world. The hash, every second (or as the profile says: decision [0014](0014-the-execution-profile.md)), says whether a copy drifted; if one does, it gets the server's state again. Replays keep working as they do: they are the confirmed inputs.

### Each one predicts only its own character

Over the internet a copy cannot wait for the server to confirm a step before showing it: the player's own character would answer the keys late. So each copy:

- **keeps the confirmed world**, advanced only with steps the server confirmed, as today;
- **predicts its own character**: its inputs not yet confirmed are applied at once, moving only the character, against the confirmed world;
- **reconciles** when a step is confirmed: it re-simulates only its own character from that step with its own inputs since then. If the server let in what it asked for, nothing moves; if not (a door closed, someone pushed it), its character goes where it really is, smoothed in the drawing, never in the simulation.

The other characters, and everything else, are seen **at the last confirmed step**: in the past, by about the latency. It is the price of not rolling back the world, and the reason for the next point.

### The server judges hits as the shooter saw them

Because the others are seen in the past, a shot is judged against **where they were when the shooter saw them**: the server keeps a history of the characters' poses (phase 4 builds it) and goes back as far as the shooter's latency, **at most 200 to 250 ms**: whoever plays with more latency aims ahead, instead of everyone else being hit behind cover.

### What it leaves open, on purpose

- **The cubes a character pushes** move at the confirmed step: online, pushing something answers with the latency's delay. Phase 6 measures whether it bothers, and decides (predicting the bodies the character touches is the next step if it does).
- **Where the server runs** (a hosted one, or one player's tab through WebRTC) is phase 6's, with its own decision.
- **Binary encoding**, only if something needs it (joining a match already started, with its state).

## Consequences

- **Good:** nothing of what exists changes: the skeleton of 1e, the hash checks, the replays and the ghosts are the same model, with prediction added on top for one's own character.
- **Good:** a correction re-simulates one character for a few steps, not the whole world: it costs a fraction of a step (2.5b measured 0.19 ms for a whole character step with its controller and its ground).
- **Costs:** the others are seen in the past; the pose history and the capped lag compensation are the answer, and phase 4 builds them before the network needs them.
- **Costs:** pushing objects online answers late, until phase 6 measures it.

## Alternatives discarded

- **Rolling back the whole world** (the fighting games' rollback): every correction would restore a snapshot and re-simulate every body for as many steps as the latency (here, 0.9 ms a step in the stress room, and 571 KB a snapshot). Ruled out by 0000.
- **Sending the state instead of the inputs:** much more bandwidth, and it throws away what determinism gives (replays, ghosts, cheap checks).
- **Pure lockstep online** (wait for everyone's inputs before each step): the latency becomes input delay for everyone. Fine between tabs, as today; not for a shooter over the internet.
