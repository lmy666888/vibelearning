# Scientific models and verification — 2026-10-15

## Electric adapter

The registered uniform-electric-field plugin delegates to the original analytic F=qE, a=F/m, v=v0+at, r=r0+v0t+½at² implementation. Existing v1 behavior remains available separately; v2 bounds its query to 60 seconds and applies declared parameter limits. Its original controls, presets, baseline comparison and authored lesson are preserved through adapters.

## Lorentz model

Uniform E=(Ex,Ey,0), B=(0,0,Bz), nonrelativistic particle in the plane:

- ax=(q/m)(Ex+vy Bz)
- ay=(q/m)(Ey−vx Bz)
- Electric force qE, magnetic force q(v×B), total force their sum.
- Magnetic power P_B=F_B·v=0 and integrated magnetic work W_B=∫F_B·dr=0.

No gravity, collisions, radiation, space charge, relativistic motion or spatial field gradients are modeled. Numerical controls and all scientific values are SI internally; UI conversions come from the shared manifest. q=0 has zero acceleration, undefined gyro radius and no charged-particle drift prediction. For qBz≠0 the uniform-field drift is (Ey/Bz,−Ex/Bz); gyroradius uses velocity relative to that drift. With E=0 it reduces to m|v|/(|q||Bz|), so doubling |Bz| at fixed speed halves radius. With nonzero E, do not infer a half-radius relationship at fixed lab-frame speed without accounting for changing drift.

## Integrator and initialization

We use a synchronized, centered Boris/Cayley variant for these uniform fields. Given position x_n and **integer-time velocity v_n**:

1. v_minus=v_n+(q/m)E h/2.
2. t=(q/m)Bz h/2, s=2t/(1+t²).
3. v_prime=(vx_minus+vy_minus*t, vy_minus−vx_minus*t).
4. v_plus=(vx_minus+vy_prime*s, vy_minus−vx_prime*s).
5. v_next=v_plus+(q/m)E h/2.
6. x_next=x_n+h(v_n+v_next)/2.

The supplied initial velocity is v_0 directly; there is **no hidden half-step velocity**. This differs from position-staggered PIC implementations and is justified here by uniform linear fields. For B=0 the trapezoidal position exactly matches constant-acceleration motion up to rounding. For pure B the velocity rotation preserves speed and the position sequence lies on the correct geometric circle; phase has second-order error. This code is not a general nonuniform-field PIC pusher.

The Boris rotation/electric splitting is documented in the primary [WarpX kinetic-particle theory](https://warpx.readthedocs.io/en/latest/theory/kinetic_particles.html) and [WarpX Boris implementation](https://warpx.readthedocs.io/en/26.09/_static/doxyhtml/_update_momentum_boris_8_h_source.html). Our synchronized position choice and tests are specified above rather than assumed from a staggered algorithm.

## Bounds and numerical budgets

Lorentz timestep 0.0002–0.02 s, duration 0.1–20 s, at most 100000 integration steps, and coupled gyro-angle |qBz/m|h≤0.02. Unstable parameter combinations reject rather than clamp. Charge ±10 nC, mass 0.1–10 mg, each electric-field component ±500 N/C, Bz ±500 T, initial velocity components ±10 m/s and initial positions ±10⁶ m. Strong fields are idealized educational parameters. These bounds keep speeds nonrelativistic in the supported time window. All state/observable values are checked finite; pure-magnetic speed deviation must stay below max(1e−11 m/s, initial_speed×5e−10).

A pure-B rotation uses phase 2 atan(ωh/2) per step. The coupled bound limits worst-case total phase lag to about 0.034 radians at the extreme supported ω=50 rad/s and T=20 s; this is a conservative phase budget, not a claim of exact time evolution at every supported extreme. Spatial circle radius/energy tests and convergence are separate from phase accuracy. Queries can include a final fractional step; RAF animation uses only full fixed ticks, stops paused at its supported horizon and never catches up an unbounded hidden-tab interval.

## Independent oracles and explicit tolerances

The reference is the continuous **trigonometric solution**, not the same integrator: for ω=qB/m≠0, subtract v_d=(Ey/B,−Ex/B), rotate u=v0−v_d by angle −ωt, integrate sine/cosine analytically and add v_d t. For ω=0 use independent constant-acceleration equations. Cross-runtime fixtures are compatibility tests, not the sole scientific oracle.

Backend cases cover no fields, electric only, magnetic-only both charge signs, combined E/B and zero charge. At preset dt=0.01 and t=7.3 s, state agreement is absolute 2.5e−4 in SI (electric/no-field 1e−10). Pure-B speed relative tolerance is 5e−10; geometric circle radius absolute 1e−10, magnetic power absolute 1e−18. Over two cyclotron periods, E×B average drift matches within 3e−5 m/s. Halving h from .02 to .01 to .005 must reduce combined state error by at least a factor 1/.26 (approximately second order). Frontend independently tests a trigonometric orbit and identical physics properties. No SciPy/integrator clone serves as the reference.

Canvas uses equal spatial scales to avoid drawing physical circles as ellipses. Force arrows use normalized lengths for direction, with explicit colors/legend; they are not a quantitative force-scale plot. The trace is limited to 2000 points and can be cleared without changing state. E-only regression, new v2 AI flows, cross-experiment rejection and DPR/responsive tests run separately from these scientific checks.

## Piecewise-uniform multi-zone fields

The separate `multi-zone-em` v1 plugin samples half-open axis-aligned rectangles, sums enabled fields in sorted ID order and uses zero outside. Its acceleration is q/m(Ex+vyBz, Ey−vxBz). Spatially varying prescribed tiles use conservative minimum-edge-gap/speed/gyro-angle substeps, with additional ballistic chord cuts at all crossed edge planes before local midpoint Boris updates. See spatial-field-experiment-guide.md for exact formulas, work budgets and corner/grazing limitations. Uniform plugins retain their original verified engines.

New independent checks include constant acceleration in a covering electric region (absolute 1e−10 SI), continuous trigonometric circle and crossed-field drift-relative solution in covering regions (position 1e−5, velocity 1e−6), a 0.1 m slab traversed at 10 m/s with analytic impulse Δvy=.01 m/s (absolute 1e−10 after chord splitting), adjacent opposite electric fields with continuous position/velocity, and two analytic magnetic arcs across opposite-polarity regions (position 2e−4). Magnetic-only speed tolerance 5e−10 relative; opposite overlapping B cancels exactly. Nonzero-charge top-edge grazing remains field-free; lower-corner entry is included. Charge zero has straight-line motion. Repeated simulation is deterministic. A boundary-entry circle refinement .02/.01/.005 s reduces error by <.3 per halving, final absolute position error <1e−6. Arbitrary discontinuous cases need not show monotonic error at every refinement; this is explicitly not a global second-order claim. Ten cross-runtime spatial fixtures check input identity and toleranced derived results independently of these scientific oracles.
