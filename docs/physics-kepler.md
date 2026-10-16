# Keplerian orbital mechanics — scientific contract

Registered `kepler-orbital-mechanics` v1, independent of EM force integration. Planar, isolated Newtonian point-mass two-body **relative** motion with μ=G(M+m), G=6.67430e−11 SI. AU=149597870700 m, Julian year=31557600 s; chosen solar/terrestrial display mass scales are declared in the shared manifest. No relativity, perturbations, collisions, stellar structure or precession.

Use semimajor axis a, eccentricity e, initial mean anomaly M0, both positive masses. n=√(μ/a³), M=(M0+nt) mod2π. Solve M=E−e sinE by safeguarded Newton/bisection in [0,2π], ≤64 iterations, residual target1e−13 rad and final failure bound1e−12. Exact roots at M=0/π are handled analytically, not by rounding output. Coordinates relative to the central body:

`x=a(cosE−e)`, `y=a√(1−e²)sinE`, `r=a(1−e cosE)`, `Ė=n/(1−e cosE)`;
`vx=−a sinE Ė`, `vy=a√(1−e²)cosE Ė`, `r″=−μr/r³`.

Specific h=xvy−yvx and ε=v²/2−μ/r are computed from the actual state, compared with √(μa(1−e²)) and −μ/(2a); errors are exposed without excessive rounding. Relative orbital energy uses reduced mass Mm/(M+m). Actual interbody force direction/magnitude is −GMm r/r³; relative acceleration includes M+m. Period T=2π√(a³/μ), exact area rate|h|/2; swept area starts at zero regardless initial phase. Equal-time sector labels use T/12; rendered polygon fans are finite approximations to those reference sectors.

Bounds: central mass.1–5 chosen solar masses, orbiting mass.01–10000 Earth masses, a.2–5 AU, e0–.9, initial mean anomaly0–360°,1–5 playback periods, binary sector flag. Main model only bound ellipses. Query time is SI seconds and bounded by configured periods. The runtime advances one orbital period per12 wall seconds at1×. Parameter/action changes reset/require existing explicit AI confirmation. `showAreas` is an integral numeric capability, not arbitrary rendering code.

Canvas uses AU for camera display coordinates but SI scientific state; the ellipse center is (−ae,0), foci at0 and−2ae, apsides a(1−e) and−a(1+e). Both foci, velocity, gravity direction, reference ellipse, recorded trail and equal-time sectors are shown; body radii are illustrative. Central-focus view is a relative frame, not an inertially stationary star. A T² versus a³ graph uses five reference orbits with the same total mass; plotted axes use AU³/Julian-year². Generic viewport restoration preserves a saved camera; a new specialized view fits its own bounds once.

Independent tests choose known eccentric anomalies E and construct M=E−e sinE before evaluation, rather than using another copy of the root solver as the oracle. Test focus-distance sum2a, circular/near-circular/high-e limits, apsides/speed ratios, μ including m, T²/a³, specific energy/angular momentum, root residual, deterministic periodicity and invalid domains. Equal-area law is checked by independent1000-segment cross-product polygon integration over two unequal-speed intervals (relative3e−6). State geometry references allow relative2e−10/absolute.1 m at astronomical scale, invariants1e−10 and residual1e−12. Cross-runtime contexts separately verify exact input identity and existing toleranced derived physics.

Primary references: [NASA, Orbits and Kepler's Laws](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/), [NASA, Gravity and Mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-3/). These explain the laws; implementation assumptions/tolerances are declared above.
