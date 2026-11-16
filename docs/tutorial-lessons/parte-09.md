# Parte 9. Jugar con otros: the lesson sheets

The design each lesson's writer follows, under the approved [curriculum](../tutorial-curriculum.md) (part 9) and
[decision 0021](../decisions/0021-a-new-tutorial.md). No book covers networking: the part leans on Fiedler and
Gambetta, and on Manifold's model as the main line ([decision 0016](../decisions/0016-the-networking-model.md)): the
server orders the inputs, everyone simulates, and each copy predicts only its own character. Rollback is the
alternative, with the measured reason against it ([0000](../decisions/0000-why-a-v2.md)).

## The part sheet

**At the end the reader can** say what makes two browsers compute the same bits, and audit a program for it; model a
channel and measure a round trip and a clock offset; play two copies of one world by sending only inputs, ordered by
a server; weigh a snapshot and say what may be compressed lossily; say who has authority; predict their own character
and reconcile it by re-simulating only it; draw the others in the past and judge a shot as the shooter saw it; and
price rollback.

**The closing game, _dos pestañas, una partida_ (a race).** Two players in two tabs, in 3.17's maze from a shared
seed, with its coins, exit and turrets, and the guard of part 7.

- **Rules:** collect 5 coins and reach the exit. The guard hunts whoever it perceives (7.12); a catch sends that
  player to the start and drops their coins. Each player has a stun shot every 5 s (part 1's turret ray, 1 s of
  freeze), judged by the server as the shooter saw it (9.8).
- **Win and lose:** the first at the exit with 5 coins wins. `restart` is a startup change: it restarts both.
- **It exercises:** a coin both reach in one step (the server's order decides, 9.6); one's own character instant at
  150 ms (9.7); the rival in the past and a stun beside a corner (9.8); loss and a hidden tab (9.2); equal hashes
  throughout (9.1); the match kept as its replay (2.14).

**How the code grows.** `net/` takes the names of Manifold's own package ([`packages/net`](../../packages/net/src)),
so the reader can read the engine beside their code.

- **9.4:** `net/channel.ts` (`Channel`: `send`, `onMessage`, `onClose`, `close`; `localPair`), `net/protocol.ts`
  (`ToServer`, `ToClient`, `Tick`), `net/server.ts` (`Server`: `connect`, `step`, `hashEvery`), `net/client.ts`
  (`Client`: `hello`, `sendInput`, `drain`), `net/tabs.ts` (`openToTabs`, `joinFromTabs`). Console: `net open`,
  `net join`, `net leave`, `net status`.
- **9.10:** `net/wire.ts` (`lossyChannel`, seeded), `net/worker.ts` (the server in a worker), `Client.predict` and
  `Client.reconcile`, `net/poses.ts` (`PoseHistory`, a ring), others drawn behind a playout delay. Console:
  `net.latency`, `net.jitter`, `net.loss` (**view** values: the network changes when things arrive, never what the
  world is) and `show.net`.
- **Paid back:** `record.ts` (confirmed inputs are a replay), `hash.ts`, `rng.ts`, 6.5's ring, 7.13's mind (the guard
  costs nothing on the wire), and 2.6's three kinds (startup restarts everyone, world changes go to the server, view
  never leaves the tab).

**Lab kit:** a space-time diagram (timelines, messages as slanted arrows, lost ones crossed out); a seeded wire
(latency, jitter, loss, order); two or three copies side by side with a strip of hash checks and the first divergent
step; a "where it is / where you see it" ghost; a ring-buffer glyph. Reused: 2.9's 64-bit viewer, telemetry, time
controls, the seed box.

---

### 9.1 Las mismas cuentas en todas las máquinas (C)

- **Question:** ¿Qué hace falta para que dos navegadores calculen exactamente lo mismo?
- **Before:** 2.9 (exact rounding, the rule, `trig.ts`), 2.14 (replays, hashes), 4.11 (Rapier's deterministic build).
- **Leads:** Fiedler, _Floating Point Determinism_; ECMA-262 (`Math`, `NumericToRawBytes`). **Also:** Dawson (C++
  worries JavaScript removes); Catto 2024 (testing an engine across platforms); Rapier's determinism page; L1 2.7.2;
  E §11.5 (exact predicates, the other road).
- **Approach:** 2.15's ghost, recorded in one browser and played in another, splits at step _N_: a `Math.atan2` hid in
  a heading. 2.9 gave the rule; this lesson proves it suffices and lists what else breaks it, as a theorem whose
  hypotheses are the audit. Fiedler's x87 and compiler flags are set aside: JavaScript forbids reassociation and
  extended precision (good news, one paragraph).
- **The mathematics:**
  1. A computation is a graph of operations on doubles; **correct rounding**: fl(_x_ ∘ _y_) = round(_x_ ∘ _y_).
  2. **Theorem:** the same graph, in the same order, on the same bits, gives the same bits anywhere. Induction in
     evaluation order; a branch is an exact comparison.
  3. **Order is program:** (0,1 + 0,2) + 0,3 = 0,6000000000000001; 0,1 + (0,2 + 0,3) = 0,6. A `Map` iterates in
     insertion order, the same only for the same history: a copy restored from a snapshot built it in another order,
     so iterate by sorted id.
  4. **What the specification leaves free:** `sin`, `exp`, `pow`, `atan2` are implementation-approximated; a NaN
     written to a `DataView` may take any encoding (canonicalize or forbid NaN before hashing); `sort` with an
     inconsistent comparator. Outside arithmetic: clocks, `Math.random`, arrival order, the version.
  5. **Why "almost" fails:** 1 ulp (≈ 2,2·10⁻¹⁶) grows like _e_^(λ*n*), reaching 1 cm after ln(10¹⁴)/λ steps.
- **The live figure:** two copies of 4.6's billiards, one seed. "Otro navegador" flips the last bit of every
  `Math.sin` in copy B (one page runs one engine); `trig.ts` against `Math.sin` is the toggle. Panel: both hashes, the
  first divergent step, log₁₀|Δ_x_| per step (slope λ). A probe card: this browser's bits for `sin`, `exp`, `pow` on
  fixed inputs beside CI's references from the three engines; `trig.sin`'s bits; the toy hash for seed 7 at step 600
  (a constant the browser test checks in all three). Perturbation: a NaN, canonicalized or not.
- **Traps:** deterministic is not accurate (Manifold's `sinCosDegrees` stopped a term early, the same everywhere); −0
  as text reads back +0 (Manifold, 1c2). "Rigor numérico": a sum's order belongs to the program.
- **Exercises:** (1) find an input where `pow` or `exp` differs between two of your browsers (1 ulp, shown as bits).
  (2) Extend the proof to a branch on a `Math.sin` result: two machines split by a whole branch. (3) From λ, predict
  when a 1-ulp nudge moves a ball 1 cm; check.
- **Our angle:** the summit of the determinism thread. Manifold measured one hash in Chromium, Firefox, WebKit and
  Node (1a), lints `sin`, `cos`, `atan2`, `hypot`, `exp`, `pow`, `**`, `Math.random` out of the simulation (1f), and
  hashes sorted keys as little-endian bytes. "Dónde Manifold eligió otra cosa": Rapier's deterministic build,
  measured (0012), rather than E's exact or fixed-point arithmetic.
- **Sources:** [Fiedler](https://gafferongames.com/post/floating_point_determinism/),
  [Dawson](https://randomascii.wordpress.com/2013/07/16/floating-point-determinism/),
  [Catto](https://box2d.org/posts/2024/08/determinism/),
  [ECMA-262](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sin),
  [Rapier](https://rapier.rs/docs/user_guides/javascript/determinism); L1 2.7.2; E §11.5.
- **Reuses:** archived 1-05's "Lo que rompe el determinismo", 1-06's chaos "Más a fondo";
  `lessons/stage-1/05-replays/hash.ts`.
- **Open:** find inputs where engines' `Math` really differ (CI; if `sin` agrees, use `exp`, `pow` or `tan`); measure
  λ; whether any engine writes another NaN encoding. Keep clear of 2.9 and 2.14: theorem, freedoms, insertion order,
  chaos.

### 9.2 Mensajes que tardan y se pierden (C)

- **Question:** ¿Qué le pasa a un mensaje entre dos computadoras?
- **Before:** 2.4; also 2.10 (a seeded stream drives the wire) and 6.5 (queues, the ring).
- **Leads:** Fiedler, _Networking for Game Programmers_. **Also:** MDN on `BroadcastChannel`, WebSocket, WebRTC data
  channels, WebTransport, Workers (what each promises); RFC 5905 (NTP's offset); G §8.5.3.1 (clocks drift: compare
  steps); GPP ch. 15 (messages arrive whenever; the step pulls them).
- **Approach:** "I pressed at step 300: when does the other copy know?" A channel is modelled before any protocol. The
  naive estimate that breaks: setting the server's clock from one message, wrong by the whole one-way delay.
- **The mathematics:**
  1. **Model:** sent at _s_, a message arrives at _s_ + _L_ + _J_ or never (probability _p_), maybe out of order; in
     steps, ⌈(_L_ + _J_)/_h_⌉.
  2. **Round trip and offset** from four stamps: δ = (_t_₃ − _t_₀) − (_t_₂ − _t_₁), θ = ((_t_₁ − _t_₀) + (_t_₂ −
     _t_₃))/2, derived assuming symmetric delays; error at most δ/2. Worked: 1000, 1100, 1101, 1061 ms give δ = 60
     and θ = 70 (each way took 30).
  3. **Redundancy:** an input carried by _N_ packets is lost with probability _p_^_N_ (5 % and 3: 1,25·10⁻⁴).
  4. **Playout buffer** _D_: the late fraction is P(_J_ > _D_).
- **The live figure:** the space-time diagram; sliders for latency, jitter, loss, ordering, from a seed. A ping runs the
  four stamps; naive and NTP estimates beside the true offset. "Una perilla, dos fallas": _D_ (stutter against lag,
  both measured). Panel: RTT, offset and its error, late fraction, out-of-order count. Test: with jitter 0, NTP's
  error is 0 and the naive one equals the one-way delay.
- **Traps:** WebSocket is TCP (ordered, head-of-line blocking); WebRTC can be unordered and unreliable. A hidden tab
  gets no frame callbacks and throttled timers (paid in 9.4 and 9.10).
- **Exercises:** (1) θ's error when the delays differ by Δ (Δ/2). (2) Copies per input for loss below 10⁻⁶ at _p_ =
  10 % (6). (3) Late fraction at _D_ = 2σ: estimate, then measure.
- **Our angle:** the simulated network is seeded, so a laggy session replays like any run. Manifold's
  `localPair({ later: true })` delays messages for tests; its tick carries a step, never a time.
- **Sources:** [Fiedler](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/);
  [MDN BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API),
  [WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels); RFC 5905.
- **Reuses:** the `wire` of `lessons/stage-1/07-server-and-client/main.ts`, grown with jitter and loss.
- **Open:** today's throttling rules for hidden tabs and their workers, per browser (they decide 9.10).

### 9.3 Al mismo paso: lockstep (C)

- **Question:** ¿Cómo juegan dos copias del mismo mundo mandándose solo las teclas?
- **Before:** 9.1, 9.2, 2.7 (commands with their step); 2.14's replay; 6.5 (the input queue).
- **Leads:** Fiedler, _Deterministic Lockstep_; Bettner and Terrano, _1500 Archers_. **Also:** Mattis part 1; GPP
  ch. 2, 9, 15; G §8.5.2.4 (playback is lockstep's ancestor); E §2.7.1 (a ring of recent queries to debug a desync).
- **Approach:** a networked game is a replay played live. The naive version: each copy applies the other's input when
  it arrives, so at different steps, and the hashes split at once. The fix is a rule: an input enters at a step both
  agree on. Two ways: everyone waits for everyone (Age of Empires), or a sequencer stamps each input (Manifold between
  tabs, the project's).
- **The mathematics:** with 2.1's step _S_, **invariant:** a copy runs step _k_ only with all inputs for _k_.
  **Theorem:** equal states at every step, by induction with 9.1 as the step. **Input delay** _d_: no stalls while
  one-way latency plus jitter stays under _d·h_. Worked: one-way 50 ms (3 steps), _d_ = 4: safe for jitter under
  16,7 ms, at 66,7 ms of input delay. **Detection:** a 32-bit hash every 60 steps misses a desync with probability
  about 2⁻³² per check.
- **The live figure:** machines A and B, each a toy-engine world with its own player, a wire between. A three-way
  toggle: "al llegar" (naive), "esperar a todos", "un servidor sella el paso". Sliders: latency, jitter, _d_. Panel:
  both steps, stalls per second, input delay, both hashes, first divergent step. Perturbation: B calls `Math.sin` once.
- **Traps:** waiting means the slowest sets the pace, and one lost message stalls all; an unchanged input is not sent
  (GPP's dirty flag for synchronization); ties in one step break by player number.
- **Exercises:** (1) one-way 80 ms ± 20: the smallest _d_ (6). (2) Show a sequencer that stamps late inputs at its
  next step never stalls, and what it costs the late player. (3) Why must the tie rule be fixed?
- **Our angle:** Manifold's skeleton (1e): every game plays through a server, even alone, so every match checks
  determinism. "Dónde Manifold eligió otra cosa": nobody waits, the server stamps (0016); pure lockstep online is
  refused for a shooter.
- **Sources:** [Fiedler](https://gafferongames.com/categories/networked-physics/);
  [Bettner and Terrano](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond);
  [Mattis](https://www.snapnet.dev/blog/netcode-architectures-part-1-lockstep/); GPP ch. 2, 9, 15.
- **Reuses:** archived 1-07's "Tres maneras de jugar en red", 1-05's "a replay is the seed plus the inputs".
- **Open:** toy engine (proposed) or Rapier in the figure.

### 9.4 Dos pestañas al mismo paso (P)

- **Question:** ¿Cómo se juega el proyecto en dos pestañas a la vez?
- **Before:** 9.3; part 8's project (maze, character, guard, console, `record.ts`, `hash.ts`).
- **Leads:** MDN, `BroadcastChannel`. **Also:** Manifold's `packages/net` and `presentation/src/tabs.ts`, as a model.
- **Approach:** "a second player in another tab". First rung: two worlds sending keys over a channel; they diverge
  (9.3's naive). Then a server that stamps steps. Last rung: the host tab also plays through its own server over
  `localPair`, so every player takes one path.
- **The project:** `localPair()` copies each message as if it travelled (a shared object hides bugs). `ToServer`
  (`hello`, `input`, `change`, `restart`), `ToClient` (`welcome`, `tick`, `say`), `Tick` (`step`, `inputs`,
  `changes`, optional `hash`). `Server` stamps inputs at its next step, adds `players.join`, hashes every 60. `Client`
  sends inputs only when they change and `drain`s ticks, checking hashes. `openToTabs` and `joinFromTabs` knock and
  answer on one channel per game. Console world changes go to the server; view values stay. A late joiner replays the
  history from birth: it works, slowly (9.5's hook). Two balls race in one maze.
- **Console check:** tab A, `seed 7; net open` gives `match open, you are player 1`; tab B, `net join` gives
  `player 2 at step …`. A minute later, `net status` in both: `checks 60 = 60, desyncs 0`. `net drop` (the client
  loses one input, as in archived 1-07) gives `desync at step …, first divergent step …`, from a ring of 60 per-step
  hashes.
- **Traps:** a hidden host tab stops its frame callbacks and freezes the match (9.10's hook); a hidden guest drains its
  backlog over several frames with a cap. "Rendimiento en el navegador": two worlds in the host tab (Manifold: 0,72 ms
  per step against 0,45 alone). Messages are cloned: plain data only (0004).
- **Exercises:** (1) a third tab: what changes? (Nothing: players are numbers.) (2) Time a join after 5 minutes (18 000
  steps at 1 ms: 18 s). (3) Refuse `restart` from player 2, like Manifold's `mayChange`.
- **Our angle:** this is Manifold today between tabs (1e, `net open`, `net join`); a tick measured about 52 characters.
  The guard is simulated by both tabs and costs nothing.
- **Sources:** [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API);
  [`packages/net`](../../packages/net/src).
- **Reuses:** archived 1-07's example (`world.ts`, `hash.ts`, the tick's shape).
- **Open:** the console's grammar for subcommands (`net open` or `net.open`) is 2.6's; joining only at a restart is
  the simpler alternative.

### 9.5 Instantáneas (C)

- **Question:** ¿Cómo se manda o se guarda el mundo entero, y cuánto pesa?
- **Before:** 6.13 (saving, Rapier's serialization), 2.4, 1.15 (_q_ ≡ −*q*); 9.4's slow join.
- **Leads:** Fiedler, _Snapshot Interpolation_ and _Snapshot Compression_; Rapier's serialization guide. **Also:** L1
  2.7.2; decisions 0000 (measured weights), 0004 (bodies by id); G2 §17.6.3.4; GPP ch. 18.
- **Approach:** 9.4's join takes 18 s; a snapshot takes milliseconds, and weighs. Two kinds from the start: **exact**
  (restore, join, branch: every bit, the engine's hidden state included) and **lossy** (to draw what someone else
  simulated). Compression belongs only to the second. The naive twin, copied body by body, diverges.
- **The mathematics:**
  1. An exact snapshot holds the game's state plus the engine's (contacts, warm-start impulses, sleep): restore ∘ save
     is the identity on the step's input.
  2. **Quantization:** range _R_ at precision ε takes ⌈log₂(_R_/ε)⌉ bits. Worked: `Int16` at 2 mm reaches ±65,5 m;
     V1's map reached 171 m, which needs 18 bits (0000's correction).
  3. **Smallest three:** with _q_ ≡ −*q*, make the largest component positive and drop it (2 bits say which). Any other
     _x_ has _x_² ≤ _c_² and _x_² + _c_² ≤ 1, so |_x_| ≤ 1/√2; 9 bits give a step of √2/511 ≈ 0,0028.
  4. **The join's arithmetic:** replay costs steps × step time; a snapshot, bytes over bandwidth plus a restore.
- **The live figure:** archived 1-06's twin: boxes fall, a snapshot at step 90, a transparent twin from the bytes.
  "Copiar a mano" (naive) diverges; "instantánea" stays identical. A bits-per-component slider restores from a
  quantized snapshot: fine to draw, diverges as a world. Panel: KB, take and restore ms, "the same since step…", size
  against bodies piled or scattered. Test: the exact twin's hash equals the original's for 600 steps.
- **Traps:** restoring Rapier makes a new world; body objects die, ids survive (0004). JSON turns −0 into 0 and NaN into
  `null`. A snapshot belongs to its version. "Rigor numérico": a float32 snapshot of float64 state is lossy (Manifold
  Lab 4.3's `Math.fround`, and why the project keeps float64).
- **Exercises:** (1) does a settled or a falling pile weigh more? (Contacts weigh.) (2) Prove the 1/√2 bound and bound
  9-bit smallest three's angular error. (3) For a 10-minute match at 1 ms a step, the bandwidth below which replaying
  beats a 571 KB snapshot.
- **Our angle:** Manifold's snapshot is Rapier's plus clock, id counter, random state, gravity and inputs; V1 measured
  244 KB, 0,75 ms to take, 3 ms to restore (a step: 0,79 ms); the stress room, 571 KB. "Dónde Manifold eligió otra
  cosa": snapshots now and then (join, save, branch), never per step for the network (0016).
- **Sources:** [Fiedler](https://gafferongames.com/categories/networked-physics/);
  [Rapier](https://rapier.rs/docs/user_guides/javascript/serialization); L1 2.7.2; decisions 0000, 0004.
- **Reuses:** archived 1-06 (figure, Memento box, "what the solver carries") and `lessons/stage-1/06-snapshots/`;
  Manifold Lab 4.3's binary layout and FNV-1a (its rewind ring is 6.13's "Más a fondo").
- **Open:** the project's own snapshot sizes and restore times.

### 9.6 Un servidor y sus clientes (C)

- **Question:** ¿Quién decide qué pasó cuando dos jugadores no están de acuerdo?
- **Before:** 9.3 (sequenced lockstep), 9.5 (joining with a snapshot).
- **Leads:** Gambetta I; Fiedler, _State Synchronization_; decision 0016. **Also:** G2 §14.1.3.2 (gameplay physics on
  the server, cosmetic on clients), §17.5.3 (ids survive across machines); G §1.5.14 (one player is the special case).
- **Approach:** two players reach one coin in the same step: whose is it? Trusting peers cannot answer a cheater. The
  server answers by ordering: a match is a sequence (step, player, input); the server decides it, and the rest is
  computed (9.1, 9.3). Three designs compared: peers in lockstep, a server sending state (Quake, Source), a server
  sending inputs and checking hashes (Manifold).
- **The mathematics:**
  1. **Latency:** with _d_ each way, an input is seen after 2_d_ plus up to a step; the client's copy is _d_/_h_ steps
     behind. Worked: 150 ms gives about 300 ms and 9 steps.
  2. **Bandwidth:** inputs at about 52 characters a tick are about 3 KB/s; the state of 200 bodies at 28 bytes is 336
     KB/s raw, about 120 KB/s compressed (9.5).
  3. **Authority:** a client sends what a player may do (an input), never a result (a position); the server checks it.
- **The live figure:** archived 1-07's server and client, plus a second client at another latency. Toggles: "manda
  entradas" against "manda estados", with a bandwidth readout; an "impostor" button (a client sends a position:
  refused); a coin reached by both in one step (the lower player number wins; the other sees it vanish). Panel: steps
  behind, time to see one's input, bytes per second, hash checks.
- **Traps:** a desync is a bug, not latency. The console's kinds decide what travels (2.6 paid back). Messages carry ids
  and player numbers, never objects.
- **Exercises:** (1) steps behind at 500 ms (30). (2) Design a late joiner's welcome (birth, snapshot, history since).
  (3) Why can an input-sending server not stop a client that sees through walls, and what would?
- **Our angle:** Manifold's `Server` keeps the match, stamps inputs, checks hashes every second; `mayChange` says who
  changes the world. "Dónde Manifold eligió otra cosa": not state replication, which costs bandwidth and throws away
  replays and cheap checks (0016).
- **Sources:** [Gambetta I](https://www.gabrielgambetta.com/client-server-game-architecture.html);
  [Fiedler](https://gafferongames.com/categories/networked-physics/); G2 §14.1.3.2, §17.5.3; decision 0016.
- **Reuses:** archived 1-07 whole (figure, "La cuenta de la demora", its Event Queue box) and
  `lessons/stage-1/07-server-and-client/`.
- **Open:** the project's tick size, measured.

### 9.7 Predecir lo propio, y corregir (C)

- **Question:** ¿Cómo responde tu personaje al instante si el servidor está lejos?
- **Before:** 9.6; 2.3 (the exact smoothing factor); 5.2 (the character as components).
- **Leads:** Gambetta II, with its live demo; decision 0016. **Also:** MA §3.5.5 (dead reckoning); Fiedler, _State
  Synchronization_.
- **Approach:** 300 ms between a key and its effect drowns the character. Naive: move it locally and ignore the server
  (it drifts); next: snap to each confirmation (rubber bands). The shape that holds is Manifold's: keep the confirmed
  world, predict only one's own character against it, and reconcile by re-simulating only that character.
- **The mathematics:** with _k_ the last confirmed step and _n_ the local one, _c_ₙ = _S_c(… _S_c(_c_ₖ, _u_ₖ₊₁; _W_ₖ)
  …, _u_ₙ; _W_ₖ). **When _k_′ is confirmed,** compare the predicted _c_ₖ′ with the confirmed one; determinism makes it
  exact. Equal bits: nothing to do. Different (a door closed, a push): re-simulate from the confirmed _c_ₖ′. **Cost:**
  (_n_ − _k_′) character steps, once per surprise; 18 steps at Manifold's 0,19 ms is 3,4 ms. **Smoothing:** the drawn
  error decays by _e_^(−*h*/τ) a step (2.3), in the drawing only.
- **The live figure:** Gambetta's three panes: client A predicting, the server, client B. Toggles: prediction,
  reconciliation, smoothing (the ladder). The server closes a door as A runs at it. Panel: pending inputs, steps
  re-simulated per second, mismatches, error before smoothing (cm), input-to-screen latency. "Una perilla, dos
  fallas": τ (a visible snap; a drawn character crossing the closed door). Test: at latency 0, mismatches stay 0.
- **Traps:** the predicted character meets others where they were. The guard's catch is decided in the confirmed
  world: a predicted escape can be undone. The client must guess its input's step.
- **Exercises:** (1) pending inputs at 100 ms each way (12). (2) Why a character that pushes a box would force
  re-simulating the world, and what 0016 leaves open there. (3) τ so a 20 cm correction is drawn in 0,2 s with under 1
  cm left.
- **Our angle:** 0016's model, "smoothed in the drawing, never in the simulation". Manifold has the skeleton
  (`Client.drain`); prediction is phase 6's, so the tutorial goes first.
- **Sources:** [Gambetta II](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html),
  [demo](https://www.gabrielgambetta.com/client-side-prediction-live-demo.html); decision 0016; MA §3.5.5.
- **Reuses:** archived 1-07's "Cómo hacen los juegos para que no se note la demora".
- **Open:** whether the client stamps its intended step (honoured when in time) or only the server decides: 0016 is
  silent. Verify that a character's step against static geometry gives the same bits when other bodies differ.

### 9.8 Ver a los otros en el pasado (C)

- **Question:** ¿Dónde están los demás cuando los ves, y a quién le pegó el tiro?
- **Before:** 9.7; 2.4 (drawing between two states), 2.5 (affine time maps), 6.5 (the ring), 3.9 (ray against shape).
- **Leads:** Gambetta III and IV; Bernier (Valve, 2001). **Also:** Aldridge, _I Shot You First_ (fairness); decision
  0016 (the cap); G2 §17.6.3.4.
- **Approach:** in the race the rival is seen at the last confirmed step, in the past. Two consequences: drawing them
  smoothly though ticks come in bursts, and shooting someone who has moved on. Gambetta interpolates sent states; in
  Manifold's model the confirmed simulation is the source, played out behind a buffer.
- **The mathematics:**
  1. **Render time** _t_r = _t_now − _D_ on the confirmed timeline (2.5's map), drawn between the bracketing steps
     with α (2.4); _D_ absorbs jitter (9.2).
  2. **Lag compensation:** rewind the target by Δ = RTT/2 + _D_ and cast there. Worked: RTT 100 ms, _D_ = 50 ms: Δ =
     100 ms (6 steps); at 5 m/s the target moved 0,5 m, the lead needed without it.
  3. **The cap:** 250 ms, a ring of 15 poses per character; beyond it the shooter leads. The trade: a victim may be hit
     after reaching cover on their screen, by at most the cap.
- **The live figure:** one moment three ways: the shooter's screen, the server now, the server rewound; a target runs
  behind a pillar. Toggles: compensation on and off; sliders for latency, _D_, the cap. Panel: Δ in ms and steps, each
  view's verdict, a "hit behind cover" counter. "Una perilla, dos fallas": _D_ (stutter; others further back).
- **Traps:** never extrapolate others (2.4's rule); index the ring by step modulo its size; the rewind touches the
  query, never the simulation.
- **Exercises:** (1) the largest RTT the cap covers with _D_ = 50 ms (400 ms). (2) Why poses by step, not by time? (3)
  Two players stun each other in one step: what does the order say?
- **Our angle:** 0016's third point (hits judged as the shooter saw them, capped at 200–250 ms); the roadmap's phase 4
  builds the pose history first. The race's stun is judged so.
- **Sources:** [Gambetta III](https://www.gabrielgambetta.com/entity-interpolation.html),
  [IV](https://www.gabrielgambetta.com/lag-compensation.html);
  [Bernier](https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization);
  Aldridge (GDC 2011).
- **Reuses:** archived 1-07's paragraph on Source's interpolation and lag compensation.
- **Open:** the curriculum's race has no shot; the stun shot carries this lesson into the game.

### 9.9 Volver atrás: rollback (C) ◇

- **Question:** ¿Cómo juegan con lag los juegos de pelea sin que se note, y por qué Manifold no lo hace?
- **Before:** 9.7, 9.5. Folded, it becomes 9.7's section "the other way: roll back the world".
- **Leads:** Infil, _Netcode_; GGPO. **Also:** Stallone, _8 Frames in 16ms_; Mattis part 2; decisions 0000, 0016.
- **Approach:** a fighting game has two characters and a tiny world, so predicting everyone and rolling everything back
  is cheap. The lesson derives rollback, prices it with measured numbers, and shows where it pays. The naive one first:
  delay-based lockstep with 100 ms of input delay.
- **The mathematics:**
  1. Predict remote inputs by repeating the last; on a contradiction at step _k_, restore _k_ and re-simulate to now.
  2. **Window** _R_ = ⌈(one-way latency − _d_)/_h_⌉ with _d_ frames of input delay (GGPO's trade).
  3. **Cost per frame:** a snapshot every step, plus restore + _R_ steps on a misprediction, inside 16,7 ms with the
     drawing. With V1's 0,75 ms, 3 ms and 0,79 ms, _R_ = 5 costs about 7 ms; the stress room's snapshot is 571 KB and
     its step 0,9 ms. Manifold's way: 5 × 0,19 ≈ 1 ms.
  4. **Misprediction rate:** inputs are piecewise constant; with _p_ ≈ 0,03 changes a step (measured on replays),
     1 − 0,97⁵ ≈ 0,14 of 5-step windows.
- **The live figure:** Manifold Lab 4.4's arena, rebuilt: the local player, the remote as predicted, the truth as a
  wire cage. Three-way toggle: delay lockstep, rollback, Manifold's model. Sliders: lag, _d_. Panel: rollbacks per
  second, steps re-simulated per frame, worst frame (ms, measured), mispredictions, snapshot size. "Una perilla, dos
  fallas": _d_ (pops at 0; sluggish when large).
- **Traps:** everything must be restorable; sounds and particles from a rolled-back step must not fire twice (events
  from confirmed steps only).
- **Exercises:** (1) RTT 200 ms, _d_ = 2: _R_ = 4. (2) Measure _p_ on your replays (2.15) and redo the rate. (3)
  Corregí al autor: Manifold Lab 4.4 lists Manifold among rollback engines; refute it from 0016.
- **Our angle:** "Dónde Manifold eligió otra cosa", measured: rolling the world back restores 571 KB and re-simulates
  every body (0000, 0016). Manifold pays instead with others in the past (9.8) and pushed boxes answering late.
- **Sources:** [Infil](https://words.infil.net/w02-netcode.html); [GGPO](https://www.ggpo.net/);
  [Mattis part 2](https://www.snapnet.dev/blog/netcode-architectures-part-2-rollback/); Stallone (GDC 2018).
- **Reuses:** Manifold Lab 4.4's figure and smoothing (its "En Manifold" and table are wrong about Manifold); archived
  1-06's fighting-games paragraph.
- **Open:** measure step and restore on the figure's scene, and _p_ on real replays.

### 9.10 El juego: dos pestañas, una partida (P)

- **Question:** ¿Cómo se juega una partida entre dos pestañas, con lag de verdad?
- **Before:** 9.8 (with 9.4's project and 9.7's model); 7.14's guard; 3.17's maze.
- **Leads:** the part's lessons. **Also:** MDN on Workers and `SharedWorker`; the roadmap's phase 6 (its networking
  lab: `show.net`, `net.loss`, `net.jitter`).
- **Approach:** two tabs have no latency, so the lesson adds a realistic network on purpose, and moves the server out
  of every tab, so a hidden or closed tab no longer freezes the match.
- **The project:** `net/worker.ts`: the `Server` in a worker shared by the tabs, over `MessagePort` channels.
  `net/wire.ts`: `lossyChannel(channel, { latency, jitter, loss }, stream)`, seeded, so a laggy match repeats.
  `Client.predict` and `Client.reconcile` (9.7): one's own character, compared bit for bit, re-simulated on a
  mismatch, the error smoothed in the drawing. `net/poses.ts`: `PoseHistory`, 15 poses per character, for the stun
  (9.8). Others drawn at _t_now − _D_. Playable: the race (part sheet).
- **Console check:** tab A `seed 7; net open`, tab B `net join`; then `net.latency 150; net.jitter 20; net.loss 0.05;
show.net`: RTT near 300 ms, about 18 pending inputs, mismatches 0 while nobody touches you, checks equal. After the
  race, `replay save`; in a fresh tab, `replay play` then `hash`: the match's hash (a networked match is its replay).
  Hide tab B for 30 s: the match goes on, and B catches up.
- **Traps:** the guard and the coins live in the confirmed world (a coin taken from under you is a reconciliation);
  network values must never change the hash; a worker has no `document` and no three.js.
- **Exercises:** (1) `net.loss 0.3`: what breaks, and what 9.2's redundancy fixes. (2) Give catches to the predicted
  world and find a race where both are caught at once. (3) A spectator tab that sends nothing.
- **Our angle:** Manifold's phase 6 in miniature, ahead of the engine: 0016's three points in one game, and its
  networking lab. The match checks determinism while played, as every Manifold match does.
- **Sources:** [MDN Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API); decision 0016.
- **Reuses:** 9.4's `net/`, 3.17's maze, 7.14's guard, 2.15's `record.ts`.
- **Open:** a `SharedWorker` (alive while a tab is open; back in Safari since 16; absent on Chrome for Android) or a
  host tab's dedicated worker bridged by `BroadcastChannel`; measure hidden-tab throttling of each. The browser test
  reads `show.net`: desyncs 0 always, mismatches 0 at latency 0.

---

## Problems found in the curriculum (part 9)

The sheets keep the approved plan; these are for the author.

1. **9.8 has nothing to judge in the project:** the closing race has no shot. The sheets add a stun shot, judged with
   lag compensation; without it, lag compensation stays conceptual.
2. **9.10's "server in a worker" needs a shared one:** two tabs cannot share a dedicated worker. Either a `SharedWorker`
   or a host tab's worker bridged by `BroadcastChannel` (which dies with its tab); hidden-tab throttling decides.
3. **9.4 joins a started match before 9.5 teaches snapshots.** The sheet replays the history from birth (slow) and
   makes that 9.5's hook; joining only at a restart is the simpler choice.
4. **9.7 needs a rule 0016 does not give:** whether the client proposes the step its input enters at. Manifold has not
   built prediction (phase 6).
5. **Missing prerequisites (earlier lessons, so nothing moves):** 9.2 uses 2.10 and 6.5; 9.3 uses 6.5; 9.8 uses 3.9 and
   2.5.
6. **9.1 overlaps 2.9 and 2.14;** the sheet narrows it to the theorem, the specification's freedoms, insertion order
   after a restore, and chaos.
