# 0023. Where a bot thinks: a bot is a player, its brain runs where the match is hosted, and what it senses is the simulation's

- **Status:** accepted
- **Date:** 2026-11-17 (accepted under the author's instruction to go through phase 4 following these recommendations)

## Context

Stage 4e brings guards that patrol, see, hear, chase, use the world and fight. Before any code, where a bot's brain runs must be settled, because the roadmap said both. Stage 2.5b opened `Cartridge.beforeStep` for "a bot's inputs", and decision [0012](0012-the-games.md) says "two players on one keyboard, a ghost, a bot and the network are the same thing for a cartridge". The two answers have long tails: one in the hash and the replays, the other in the session and the network.

What there is to build on:

- **Every input carries its player** (0012), the session orders them, and a replay is the confirmed inputs (1b, 1d). A ghost is a replay's inputs fed as a player.
- **The server orders the inputs and every copy simulates them** (0016). Alone, the page runs its own server (stage 2.5a: `match.ts`). In phase 6 a server runs remotely.
- **The senses are already the simulation's:** a watcher sees by the light (3d: `seen`, `lost`), a sound has a radius (3f), and a crouching character is seen and heard less (4b). They are the same on every copy.
- **Characters ask for actions:** walking, facing, aiming, jumping, crouching, rolling, using, attacking are inputs, and a game's actions are declared (1d).

## Decision

### A bot is a player

- A bot has a **player number**, joins like any player, and its character is the game's, made the way a person's is. It asks for the same actions a person does, as inputs; the session orders them and **replays record them**. Every copy simulates them as it does a person's.
- So a guard can do only what a player can: what the simulation lets a character do (its capabilities, its modes) is the whole of it. A brain cannot move a body by hand.

### Its brain runs where the match is hosted, once

- **A brain is a function of the game** (`Cartridge.brains`, by name): given the world as it is after a step (read only) and its own memory, it returns the inputs for the next step. The host of the match runs it: the page's own server when the page plays alone, the remote server in phase 6, a test's harness in Node. **One copy runs it.** Every other copy, and every replay, gets its inputs.
- **It answers one step late** (17 ms at 60 steps a second): it reads step _n_ and its inputs enter step _n_ + 1, as a person's do. A person's reaction is ten times that.
- **Which characters a host thinks for is world data:** a component on the character names its brain and its parameters (`brain`: a name, a route to patrol), placed by the level like the rest of it. It is part of the state, in the hash, so any host knows which brains to run for which players. A person can take a bot's player over (`possess`, 4e): the host then sends the person's inputs for it and not the brain's.
- **Its memory is plain data, kept by the host beside the world, out of the hash:** what it heard and where, how suspicious it is, where it last saw someone. The host's own snapshots carry it (so `step back` in 4e restores the brains with the world). A replay does not need it, and a copy that does not host never sees it.

### What a bot senses is the simulation's; what it decides is its brain's

- **Seeing, hearing, noticing** are the simulation's mechanisms (3d, 3f, 4b), computed on every copy alike, as events and queries the brain reads: the same for a person's page and for a guard's brain. The brain only decides what to do about them.
- **Its arithmetic is free:** only one copy runs a brain, and what it decided travels as inputs, so a brain may use the browser's trigonometry and floats as it likes, and a brain changed tomorrow does not break yesterday's replays. Brains use the simulation's arithmetic where it costs nothing, so that a test in Node and a page in a browser decide the same.

## What it leaves open, on purpose

- **The brains themselves** (patrol, look into a light or a sound, chase, use a mechanism, attack) and their memory's shape: 4e's code.
- **Navigation** (which graph, how a level names its routes, edges that need a capability or a mechanism's state): decision 0024.
- **How many brains a page can run** and whether the host moves into a worker: 4e's budget measures it.

## Consequences

- **Good:** replays outlive brains. A replay recorded with today's guard plays back to the same hash after the guard's brain changes, as a person's replay does after the page changes.
- **Good:** the brain is out of the hash and out of the determinism rules; it is written like any program, and tested in Node by running it.
- **Good:** the network costs nothing new. In phase 6 the server hosts the brains, and the clients get the bots' inputs as they get anyone's. `possess` is routing a page's keys to another player number.
- **Costs:** replays grow by the bots' inputs (a guard steering changes its inputs often). 4e measures it; the replay format writes only changes.
- **Costs:** a bot answers a step late, and its brain runs on one copy only, which pays for it: the page alone, the server in phase 6.
- **Costs:** a brain's memory lives outside the world, so a world snapshot alone (a link, `snapshot`) restores the bots without it: they start again from what they sense. The host's snapshots carry it.

## Alternatives discarded

- **The brain in the simulation** (`beforeStep`, 2.5b): every copy computes it and a replay stays small, but changing a brain breaks every replay that had it, every copy pays for every brain, and the brain must be deterministic to the bit (no browser trigonometry, no floats that differ between engines). Its memory would be in the hash, and a guard's every thought a cost of the state.
- **The brain on every copy, its inputs predicted:** the copies would disagree whenever a brain did, and fixing that is the network's job, done once for everyone in 0016.
- **Brains that move bodies directly:** a guard that could do what a player cannot is a different game, and the replays could not record it.
