<!-- Design bible: amended in place, NOT append-only (conventions taxonomy rule).
     Origin: plant-world-model-skeleton.md, written by Chris 2026-08-27.
     Amended 2026-08-27 after a design session with Chris. Still incomplete —
     remaining open decisions are listed at the bottom and mirrored in DEVPLAN Stage 0. -->

# Plant World — Model

## Purpose

**Evolution.** The question is how plant form and life-history strategy evolve when
development is a resource-gated program and the environment is a competitive resource CA.
A companion question, available cheaply because it falls out of the same code, is
**encoding-theoretic**: what does a self-modifying instruction tape buy over a conventional
L-system rewriting system?

Both 2D and 3D are wanted. Cellular (lattice) is the starting point; continuous space is of
interest, and the same alphabet runs on either — though branch *angles* are quantised on a
lattice and continuous only off it (see *Divergence angle*).

## What kind of machine this is

This is **not an L-system**, and the difference is the point.

An L-system is a parallel *rewriting* system: the genome is a rule set, development is n
rounds of rewriting, and a turtle walks the finished string once at the end. Plant World has
no rules and no rewriting. It has a **tape, a read head, and a program counter per growth
tip**. Development *is* execution.

Three consequences, which are the model's actual contributions:

1. **Branching is a `fork`, not a bracket.** `B` spawns a concurrent tip with its own read
   head, position, heading, and resource share. Two tips of one plant can sit at different
   points in the same program, hold different resources, and die independently. Genetically
   identical meristems differentiate because the environment differs. (Contrast: an
   L-system's `[...]` is a static substring one turtle traverses in a single sweep.)
2. **The environment holds the program counter.** An instruction executes only when the tip
   can pay for it. Genome and environment jointly determine which instructions ever run.
   Měch & Prusinkiewicz reached environmental sensitivity by adding query symbols to the
   rules; resource-gating gets it from the execution model instead.
3. **Size is not encoded.** `*` (below) extends a tip indefinitely; maintenance cost rises
   with size while photosynthesis saturates, so growth stops where marginal sugar gain meets
   marginal maintenance. The genome encodes form; the economy sets scale.

**Design rule that follows:** *the language is permissive, the economy is what constrains.*
When something needs limiting — genome bloat, plant size, branching ratio, seed number —
the fix goes in the resource economy, not in the grammar. Applied throughout below.

---

## Grid and environment

- 2D lattice: soil rows at the bottom, air above. (3D voxel later; see *Open*.)
- Cell `type`: `soil`, `water_source`, `air`, `root`, `stem`, `leaf`, `seed`.
- Soil cells carry `moisture`. Plant cells carry resource pools.
- **Soil hydrology.** One moisture field per cell, 0..1, with three thresholds that each do
  a distinct job. Soil *texture/porosity* is not modelled (a possible future heterogeneity
  axis — sandy patches drain, clay patches hold); what matters more, and is modelled, is that
  conductivity depends on how wet the soil already is.
  - **Field capacity** (0.35): only moisture above it drains under gravity. Without this the
    whole profile drains into the table and goes dry.
  - **Unsaturated conductivity** K(m) = m^exp (exp=2): flux between cells is D·K(m̄)·Δm, with
    K at the pair mean so the scheme stays conservative. **Dry soil is a poor conductor.**
    With constant K the table wets the surface (measured: surface settles at 0.119 with rain
    off), a shallow root lives off the table, and the two-layer distinction collapses. At
    exp=2 the dry surface disconnects (0.009) while depth holds 0.302.
  - **Wilting point** (0.08): below it water is held too tightly to extract. Uptake scales
    with *available* water, (m − wiltingPoint), never `min(rate, m)` — a step function makes
    a root at m=0.02 perform identically to one at m=1.0, which flattens the water niche
    entirely (measured: depth 1 and depth 32 both returned exactly 0.0200/tick).

  **What the moisture profile actually is — measured, because the intuitive reading is wrong.**
  It is tempting to describe this as gravity pulling water down, diffusion carrying it up, and
  the two balancing into an emergent water level. All three parts of that are off:
  - **Diffusion is isotropic**, not upward. It moves water from wet to dry in every direction;
    the net flux is upward only because the source sits at the bottom.
  - **The table level is imposed, not emergent.** It is a Dirichlet boundary pinned at
    moisture 1.0 and never updated. What is emergent is the *profile above it*.
  - **There is no static equilibrium.** At steady state water is still moving: net upward flux
    0.0139 across a cut 20 rows above the table, with no downward component there (everything
    is below field capacity, so drainage is inactive). It is a steady **throughflow** —
    table → soil → atmosphere. With no sink at all there is no level, only slow saturation
    (mean 0.250 → 0.267 → 0.335 at 2k / 20k / 80k ticks, still climbing).

  What does set the profile:
  - **Gravity does most of the shaping.** drainage=0 gives 0.929 at depth 40; drainage=0.2
    gives 0.341. Strongly sensitive.
  - **A sink is necessary, but its rate barely matters.** A 15x change in evaporation
    (0.002 → 0.030) moves only the top cell (0.034 → 0.002); depth 1 downward is identical to
    three decimals. Transport is **conductivity-limited** — K(m)=m² at m≈0.1 is 0.01, so the
    dry layer is nearly an insulator and the sink can only take what the soil delivers. Any
    sink strong enough to hold the surface near zero yields the same profile. This is a
    robustness property: profile shape is set by soil physics, not by sink strength.

  **Known limitation.** Real soil above a water table reaches a genuine static equilibrium
  where gravity balances matric suction at zero net flux. This model cannot: its transport is
  concentration-gradient diffusion, not matric potential, so below field capacity nothing
  opposes it and the profile drifts toward saturation whenever sinks are weak. Field capacity
  + drainage is the standard ecohydrology **bucket approximation** — defensible, but it means
  the environment has a slow drift rather than a resting state. Irrelevant at run length
  (1500 ticks vs ~100k for the drift, with plants transpiring throughout); worth knowing
  before any long unattended run.

  **Why the table stays pinned.** A finite aquifer that recharged from rain and depleted from
  uptake would make the level emergent and add drawdown/drought-year dynamics. Deliberately
  not done: the two-layer mechanism requires the deep source to be **reliable**, and a table
  that moved with rainfall would couple the deep layer to the shallow one and blur exactly
  the distinction that generates the niche. Temporal variability comes from rain instead.

  **Verified: a sink genuinely draws from the table.** With rain and evaporation off, soil
  water stays flat while uptake continues indefinitely — the table resupplies through the
  gradient. A dense root mat is supply-limited (640 roots got 2% of their demand), so
  competition for water is real rather than nominal.

- **Water — two qualitatively different sources, and the difference is the point.**
  - **Water table**: deep, reliable, reachable only by deep roots. Diffuses upward.
  - **Rain**: episodic, wets the *surface*, transient. Rewards shallow spreading roots and
    fast opportunistic uptake.

  These are not two instances of one thing. Together they are **Walter's two-layer
  mechanism** — the standard account of savanna tree/grass coexistence, where grasses
  preempt shallow rain water and trees live off subsoil water grasses cannot reach. It
  yields a deep-rooted and a shallow-rooted strategy that can coexist, and a clean ablation
  (rain only / table only / both) with the prediction that coexistence appears only in the
  third. Both are consumed by uptake, so competition is real.

  **Measured, Stage 1: the ranking inverts between regimes.** Table only, a root at depth 30
  outdraws one at depth 2 by ~90x (13x at the shorter smoketest settle). With rain, depth 2
  outdraws depth 30. Two strategies, each best under a different water regime — the mechanism
  is a demonstrated property of the environment, not an assumption, and two smoketest
  assertions guard it.
- **Light**: modelled, and **graded, not binary**. Sweep each column top-down accumulating
  transmittance: T starts at 1, each intervening leaf multiplies it by τ < 1 (stem lower).
  A leaf receives light ∝ T. Still O(width × height), one multiply instead of a flag.
  **This is not an optimisation, it is a precondition for diversity** — a binary lit/unlit
  shadow makes shade lethal, which eliminates the understory niche and therefore canopy
  stratification. See *Diversity and niches*. 3D breaks the column trick — see *Open*.

  Light falls **straight down** in v1. An **angled, day-sweeping** variant is available and
  is the version of a day/night cycle that would earn its cost: shadows sweep, so a plant
  east of a tall neighbour catches morning light, giving *lateral* light heterogeneity
  instead of purely vertical — a real understory niche. Still cheap (a sheared column sweep
  rather than a vertical one). Not in v1; see *Open*.
- **CO2**: not modelled. Global constant.
- **Heterogeneity is required, not decorative.** A flat water table under uniform light has
  exactly one optimum and can only produce one strategy. Patchy moisture and uneven terrain
  are what let a root-investing and a shoot-investing strategy each be locally best. First-
  class parameters, present from Stage 1.

## Resources

Two pools, both required. This is what makes root/shoot allocation a genuine trade-off; a
single merged pool would erase it.

- **Water** — taken up by root cells from local soil moisture.
- **Sugar** — produced by leaf cells from `light × CO2_constant`.
- **Transport** — diffusion between plant-graph neighbours each tick. Water rises from
  roots, sugar descends from leaves. Tall plants are penalised by transport lag; this is
  treated as a feature, not a defect, until evidence says otherwise.
- **Growth** requires both, Liebig-minimum style.
- **Execution rate** — each tip attempts **one instruction per tick**, and executes it only
  if it can pay. The economy is deliberately tuned **slower than the clock**, so the tick
  rate is a ceiling and the realized developmental rate is set by resource acquisition. A
  tip that cannot afford its next instruction banks and waits.

  Three consequences, all wanted:
  1. **Developmental timing becomes a phenotype, not a genome property.** Sibling tips forked
     from one `B`, running identical programs, desynchronize on local conditions alone — the
     lit one runs ahead, the shaded one lags. This is the concrete numerical basis for the
     meristem differentiation that fork semantics was chosen for.
  2. **Branching is limited by local supply, on top of the geometric cap.** Whatever the tip
     count, tips on a node compete for that node's bank, so more tips means each grows
     slower. What limits real branching is the carbon to build the branch, not the carbon to
     make the bud. See *Costs*.
  3. **Self-pruning and crown rise fall out.** With per-cell maintenance and local-ish sugar
     transport, shaded lower branches fail to pay their own maintenance and die. A clear bole
     under a crown is one of the most recognisable properties of a tree; getting it
     emergently rather than coding it is a strong signal the economy is calibrated.
- **Maintenance** — every living cell costs sugar per tick. This is the term that makes
  size expensive and produces the size/allocation balance.
- **Genome cost** — a small per-symbol cost for *carrying* the tape (not for executing a
  symbol), so genome length is selected on rather than imposed. This is the bloat control
  (see `*` below).

### Costs

**Uniform by type.** Each cell type has one build cost, the same for every instance.
Control flow (`!`, `@`, `*`) is free. **`B` is free** — it produces no cell, only a new tip,
and the branch's real cost is paid by whatever cells the child goes on to build. That matches
the biology: dormant axillary buds are cheap, and the carbon to build the branch is what
limits branching.

**Sugar and water are not symmetric.** Sugar is the building material — cell walls are carbon
skeletons, so sugar is consumed and locked permanently into the structure (a **stock** cost).
Water is not built in: it drives cell expansion by turgor and is then continuously lost to
transpiration (a **flux** requirement). So:

- Building a cell costs **sugar**.
- Growth additionally requires **water above a threshold**.
- **Leaf area drains water every tick**, growing or not.

The transpiration term is load-bearing for diversity, not a detail. If water were consumed
only when growing, drought would mean slow growth and never death, root investment would buy
nothing but speed, light would stay the dominant axis, and the outcome would collapse back to
a height race. With transpiration, a leafy plant in dry soil *dies*, root investment buys
survival, and root:shoot becomes genuinely contested.

### Tips are local accumulators

A tip sits on a node, draws that node's water and sugar into itself, and builds when it has
banked enough. **Tips draw from the local cell's pool, never a shared plant pool.**

Everything about branching economics follows from this without any rule enforcing it. Several
tips on one node compete for one node's bank, so the likely outcome of heavy local branching
is no growth or very slow growth — unless the node is an old, trunk-ish one fed by a lot of
leaf area. Heavy branching becomes something only a well-supplied node can afford. Local
pools are also what make shaded lower branches starve while lit ones thrive, which is the
mechanism self-pruning depends on.

### Branching is bounded by geometry, not economics

A node has 6 faces; one is where the tip arrived from. **At most 5 branches per node in 3D,
and only 3 in 2D.** `B` fails when there is no free face — you cannot put a bud where there
is no room. The branching factor is structurally capped before economics enters.

This closes the tip-proliferation worry. A runaway genome like `B *` builds no cells, so it
has no leaves, earns no sugar, and starves; it was never a strategy selection could favour,
only a dead plant. **Per-tip maintenance is therefore not needed as a safety measure.** It
remains available as a modelling choice — it would give apical-dominance economics, a bud
being a claim on future growth that taxes you to hold — but that is a design option, not a
safeguard, and it is **out of v1**.

### Positional cell fate (`G` vs `R`/`S`)

Plants specify cell fate by **position, not lineage** — ablate a cell in the Arabidopsis root
meristem and whichever cell moves into the vacated position adopts that fate; a stem cutting
in soil makes adventitious roots. `G` models this: the genome specifies geometry, the world
specifies tissue.

This buys plasticity with nothing added to the language — the same genome in dry versus wet
soil produces different root:shoot ratios, a germinating seedling transitions correctly as it
breaks the surface, and a stolon that dives back into soil roots there. It also removes a
large class of nonsense genotypes (roots instructed into the air), which matters for
evolvability: most of genome space should make *some* kind of plant.

`R` and `S` are retained as explicit overrides so underground stems and aerial roots stay
expressible. They cost an extra symbol relative to `G`, so they are rarer in genome space —
which is correct, since both are derived specialisations rather than the default condition.

### `!` and `@` are a counted-loop language

Because `!` moves the origin that `@` returns to, the two compose into sequential counted
blocks:

```
A ! B @@@ C          →  A ; B B B B ; C
A ! B @@ ! C @@@ D   →  A ; B B B ; C C C C ; D
```

Each `!` closes the previous loop and opens the next. n consecutive `@`s give n+1
repetitions.

**Unary encoding is deliberate.** Inserting or deleting one `@` changes the repeat count by
exactly ±1 — small mutation, small phenotypic effect, a smooth landscape on a quantitative
trait. A binary-encoded count would have a high bit that halves or doubles segment number in
one hit. Unary runs are also the direct analogue of microsatellites, where slipped-strand
mispairing expands and contracts tandem repeats — a major real source of quantitative
variation. So "duplicate or delete one element of an `@` run" is a mutation operator with a
biological referent, not an invention.

### `@` versus `*` — determinate and indeterminate growth

Every real plant has both. Leaves, flowers and fruits are determinate (fixed cell number);
shoot apices, root apices and cambium are indeterminate. A model with only one operator can
represent only half of plant development, and *which one a lineage commits to* is precisely
the annual/perennial, determinate/indeterminate axis selection should be free to move.

`B` already makes genomes non-terminating (a child re-reads from 0, hits the same `B`, and
forks again — it is a recursive self-call), so the resource economy is already doing the
halting work and `*` costs nothing that wasn't already being paid.

`F` placement then expresses life history in the same language as everything else:
`... ! F @@@@` is a terminal burst of five seeds — a monocarpic annual. An `F` inside a `*`
loop is a perennial flowering each cycle.

### Alphabet constraint: no lethal sites

**No symbol may, by single-point appearance anywhere in the genome, kill the organism.**

This is why there is no `]` / end-of-tip symbol. A tip already ends by running off the end of
its tape, so the function needs no character — and a terminator would make *every position*
in the genome a lethal mutation site, which is a nonsense mutation, one of the most damaging
classes in real genetics precisely because it destroys everything downstream of an arbitrary
point.

The test is **unreachable-but-alive versus unreachable-because-dead.** The first is a neutral
reservoir; the second is a minefield. Checking the set:

- `*` — a spurious one silences the tail, but the plant lives (indeterminate instead of
  determinate), and deleting the `*` restores the tail intact. **Passes.**
- `!` — deletes the prefix, which has already executed. Destroys no future information; a
  spurious `!` rearranges loop boundaries but nullifies nothing. **Passes.**
- `@`, `G`, `R`, `S`, `L`, `B`, `F` — no silencing at all. **Pass.**
- `]` — **fails.** Dropped.

Corollary: **do not "repair" `*` by truncating after it or forcing it to the end.** That
converts a reversible silencing into a permanent germline deletion — one mutation,
information gone forever. It is the `]` failure mode one level up, at the lineage rather than
the individual. Bloat is controlled by the per-symbol genome cost instead.

### No stack

The stack in the original skeleton was load-bearing only under the L-system turtle reading,
where `[`/`]` save and restore *shared* turtle state. Under fork semantics each tip carries
its own position and heading, so there is nothing shared to save. `B` needs no partner
symbol.

### Divergence angle δ

`B` places the child on one of the node's free faces, selected by *k·δ* where k is the
branch index at that node.

**On a lattice, δ is quantised and is a face-selection rule, not an angle.** Headings take
6 values in 3D and 4 in 2D, so branch turns are multiples of 90° and phyllotactic 137.5° is
unreachable. δ therefore reduces to *which free face to take next*, by index. Still
evolvable, still generates different branching patterns, but there is no golden angle and no
continuous phyllotaxis. (An earlier version of this document claimed one float carried the
same genome smoothly between 2D and 3D. That is only true off-lattice.)

Continuous phyllotaxis is available **only** in the spatial-rather-than-cellular variant,
where δ is a real float and geometry is rasterised onto the grid. That is now the sharpest
reason to care about the continuous fork, and it is recorded in *Open*. No 3D rotation
symbols are needed either way.

---

## Reproduction

Two modes, and only one of them needs machinery.

### Clonal — free, emergent

A stolon is a lateral stem that puts down a rooted tip; a rhizome is the same underground.
That is `B` with a lateral heading running `S` then `G`. The only missing ingredient is
**disconnection**, and that needs no symbol either: a plant is a connected graph of cells
sharing a resource pool, so when a connecting stem cell dies the graph splits into
independent individuals. Clonal reproduction falls out of growth plus mortality.

This asymmetry is not an accident of the design — the cheap, local, genotype-preserving,
space-monopolising mode is the one the growth mechanism already implements, and the
expensive, dispersing, variation-generating mode is the one that needs adding. Allocation
between them is therefore an evolvable strategy rather than a parameter.

### Sexual — one instruction plus a cost

`F` costs a large lump of sugar and produces a dispersing propagule. Genome says where and
when; economy says whether. Dispersal kernel, dormancy and germination conditions are
parameters.

**v1 is selfing/apomictic** — the seed carries a mutated copy of the parent germline. That is
enough to get evolution running. Outcrossing adds pollen dispersal, mate availability,
density dependence and the question of why sex pays for itself; all interesting, none of it
needed before there are plants that evolve at all.

### Germline: the seed carries the *untruncated* genome

`!` is per-tip and somatic. A seed carries the original genome plus mutations, never the
tip's truncated working copy. The branch commits; the seed does not. This gives **Weismann's
barrier for free** — a plant that truncated heavily still produces offspring with full
potential.

The Lamarckian variant (seed carries the somatic copy) is a one-line switch rather than a
redesign, and is worth keeping available as an experimental condition.

## Mutation operators

- Point substitution, insertion, deletion.
- **`@`-run expansion / contraction** (± one element) — the microsatellite analogue; the
  smooth lever on quantitative repeat traits.
- **Subtree duplication** — copy a `B`-rooted region. Tandem duplication and divergence is
  how real genomes build modules, and it gives evolution literal raw material rather than
  requiring reuse-by-reference.
- Mutation on δ.

---

## Disturbance and temporal structure

A spectrum from emergent to exogenous. They do different jobs and should be separate knobs,
not one dial.

**Emergent — free from the economy.** Starvation: a cell or tip that cannot pay maintenance
dies. Endogenous and density-dependent, so it self-regulates.

**Genomic — already in the alphabet.** A plant with `*` never finishes its tape
(indeterminate, perennial); a plant without one runs off the end and stops (determinate,
annual). The annual/perennial axis is therefore the presence or absence of a single symbol.
One gap: running out of program leaves a live *static adult*, not a dead plant. True monocarpy
— flower once then die, as in annuals, agave, bamboo — needs an explicit senescence rule tied
to `F`. Cheap, and it completes the life-history axis.

**Exogenous — and here one distinction does most of the work.**

*Scattered mortality is not gap disturbance.* Random single-cell death adds noise; a pioneer
cannot establish in a one-cell hole before being overtopped. What generates successional
diversity is **patches large enough to grow up in**. So the parameter that matters is not the
disturbance rate but the **gap size distribution** — and gap size is itself a niche axis, with
large gaps favouring fast pioneers and small ones favouring shade-tolerant slow growers. Have
both random mortality and patch kills, tuned separately.

**Seasons.** Worth having, but most of the payoff arrives with Stage 6. Fluctuating conditions
generate coexistence through the storage effect — but a plant with no sensing cannot *time*
anything to a season, only passively endure it. The mechanism is real and mostly dormant until
the language can read the environment.

**Day/night.** Deliberately **not in v1** as intensity modulation. Pure intensity variation
only bites if something responds nonlinearly — plants would need to starve overnight, which
means sugar storage capacity becomes a trait. Without that it is arithmetically close to
scaling light down, and it costs a timescale. The version that would earn its keep is the
*angled, day-sweeping* light in *Grid and environment* — lateral rather than vertical light
heterogeneity.

## Diversity and niches — the actual goal

The hoped-for outcome is **diversity**: leafy bushes, tall trees, distinct recognisable growth
forms, with the dynamics generating niches rather than the parameters assuming them.

### The default outcome is a monoculture height race

This is predictable now and should not be discovered in Stage 5. Light competition is
**asymmetric** — a taller plant shades a shorter one and never the reverse — so it is
winner-take-all, and every lineage evolves to be as tall as it can afford. One resource, no
trade-off, one optimum, one strategy. (This is also what really happens: the height-as-
competitive-game literature exists because real trees are taller than would be optimal for
the stand. Height is competitive investment, not productive investment.)

Diversity requires strategies to **limit themselves more than they limit each other**. Four
mechanisms make that possible here. All are cheap; none is optional if diversity is the goal.

1. **Graded light** (see *Grid and environment*). Binary shadow makes shade lethal and
   deletes the understory niche outright. Highest-leverage single decision on this list.
2. **Spatial heterogeneity — and specifically two water sources.** Patchy water and uneven
   terrain, so root-investing and shoot-investing strategies each have somewhere they win.
   The strongest single version is **rain + water table**, which is Walter's two-layer
   mechanism: a deep-rooted and a shallow-rooted strategy that partition the same resource by
   depth and timing. See *Grid and environment*.
3. **Mortality and gaps** — with **gap size**, not disturbance rate, as the parameter that
   matters (see *Disturbance*). Disturbance opening space is the classic generator of plant
   diversity, via a colonisation-versus-competition trade-off — fast pioneers against slow
   shade-tolerant late-successional forms, sorted by gap size. The underlying trade-off is **already latent in
   the economy**: heavy leaf investment earns more sugar but costs more maintenance, so it
   wins in light and starves in shade, and sparse investment does the reverse. That is the
   leaf economics spectrum, obtained without adding a parameter.
4. **Local dispersal.** A global seed kernel means the best competitor wins everywhere. A
   local kernel leaves refuges, and dispersal distance becomes its own evolvable trade-off.

### Why the encoding itself may favour distinct forms

The mutational landscape is **anisotropic**. `@`-runs mutate in unary, so size and segment
number vary continuously. But `B` and `*` are single symbols with enormous phenotypic
consequence — branch or don't, determinate or indeterminate. Large-effect discrete switches
are exactly what produces **distinct clusters rather than a continuum**, which is what niches
look like in data.

This matches real plants more closely than it has any right to: growth habit is often a few
large-effect loci. `tb1` (teosinte branched1) is a single locus switching maize from bushy
and tillering to a single stalk — the classic domestication-genetics result. The encoding
reproduces that structure by accident: growth **form** is a discrete genomic switch, size
**within** a form is continuous. This is a real, testable prediction of the model.

### The research question, sharpened

Not "does diversity emerge." Most coexistence models assume the strategies and ask whether
they coexist. Here the strategies must be **discovered by evolution through a developmental
encoding**. The question worth answering is: *do standard coexistence mechanisms still
generate niches when morphology is evolved rather than parameterised?*

### Measurement: store the vector, not a scalar

Per plant, write a **trait vector** into the packet — height, width, root:shoot, leaf
fraction, branch count, mean internode, genome length, clonal:sexual allocation, lifespan,
realized fitness — and compute diversity post hoc. The diversity measure *will* change; runs
are expensive; do not bake a scalar into the sim and lose the raw data.

The measure itself must be **modality, not variance.** One strategy with noise produces a
wide unimodal blob and an excellent-looking variance number. Niches mean *modes*. Headline
measure: the number of distinct morphospace clusters sustained above ~1% abundance across
many generations — coexistence **over time**, not in a snapshot. A bimodal height
distribution is the specific signature of canopy/understory stratification.

## Open decisions

Carried in DEVPLAN Stage 0. These are genuinely undecided, not merely unwritten.

- **δ — one float per genome, or per-branch-point?**
- **Calibrating "slower than the clock."** The execution rate is decided (above) but the
  numbers are not. How much slower does the economy need to be before tips are usually
  waiting rather than usually executing? This is the main tuning job of Stage 3.
- **τ, the per-leaf light transmittance.** Sets how deep an understory can be, and therefore
  how much stratification is even possible. A first-order control on diversity.
- **Environmental sensing.** Positional cell fate is the free version. Nothing in the
  language yet *reads* the environment — no tropism (gravity, light, moisture), no
  conditional. Adding a query/conditional symbol is the Měch–Prusinkiewicz "open" move and
  would let an indeterminate meristem transition to determinate (which is floral induction).
  Deferred, but it is the largest single expressive gap.
- **Is dead code behind `*` a reservoir or noise?** Depends on mutations accumulated while
  silenced ≈ rate × length × generations-dead. Below ~1, re-activation yields a variant of a
  recently-working program; well above, noise. Instrument it and measure rather than decide.
- **Transpiration rate per unit leaf area.** Sets how hard water bites relative to light,
  and therefore how strong the root:shoot niche axis is. A first-order control on diversity,
  alongside τ.
- **Gap size distribution.** The parameter that decides whether successional diversity is
  possible at all (see *Disturbance*). Needs a form, not just a rate.
- **Monocarpic senescence.** Whether running out of program after `F` kills the plant, or
  leaves a static adult. Completes the annual/perennial axis if adopted.
- **Angled day-sweeping light.** Costed and understood, deliberately not in v1. Adopt if
  vertical-only light proves too weak a source of lateral heterogeneity.
- **Per-tip maintenance.** Not needed as a safeguard (geometry caps branching). Available as
  a modelling choice for apical-dominance economics. Out of v1.
- **Cell death and decay.** Do cells die of age as well as starvation? Does dead matter
  return to the soil? Without turnover, long runs just fill the grid.
- **Collision.** Tip grows into an occupied cell — stall, die, or grow through? Self versus
  other-plant may differ.
- **Cost schedule refinement.** v1 is uniform-by-type (see *Costs*). Whether costs should
  ever scale with depth/age/distance-from-root is open, and deliberately not v1.
- **Disturbance regime.** Gaps are required (see *Diversity*), but the form is open: random
  cell death, patch kills, seasonality, or emergent-only from starvation.
- **Continuous space.** Now has a concrete motivation rather than a vague one: continuous
  phyllotaxis and non-quantised branch angles are reachable *only* off-lattice (see
  *Divergence angle*). Not yet costed.

## Prior art

- Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants* — turtle interpretation of
  bracketed strings; the direct ancestor of `B`, and the control encoding to compare against.
- Měch & Prusinkiewicz, open (environment-sensing) L-systems — closest existing work; the
  contrast is query-symbols versus resource-gating.
- Runions et al., space colonization — the non-genomic alternative to branching; useful as a
  contrast case.
- Ray (Tierra), Ofria & Wilke (Avida) — linear self-modifying genomes executed by a head;
  the ancestry of `!`/`@`, and the source of the dead-code-as-reservoir argument.
