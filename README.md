# Conformer Ensemble Viewer

**Live demo:** https://galmungral.github.io/conformer-viewer/

## Rhetorical Design

### Goal

For a general audience, we illustrate that a molecule's geometry is a
distribution over conformational space, not a fixed structure. We do so
through an interactive three-dimensional visualization — a modality that
affords simultaneous overlay of all conformers and animated inspection of
individual members, neither of which is achievable in static media without
loss of the other.

### Strategy

Conformers are rendered with additive blending, collapsed onto one another,
encoding frequency as brightness. Pressing **Space** separates them into a
cubic grid. The animated transition makes the correspondence between the
ensemble and its members explicit — this is the rhetorical function the
interactive modality uniquely affords.

## Technical Challenges

### Opacity calibration

**Problem.** To create the visual cue of a conformational distribution —
brighter regions suggesting higher occupancy — additive blending must be
calibrated so that brightness reflects how many line segments from the
wireframe representations of the conformers coincide at a given position and
orientation, rather than dataset size.

**Assumption 1.** This count is a good enough proxy for illustration purposes
— only geometry and counting are needed.

**Model.** Each bond is a line segment occupying a point in
$`\mathbb{R}^3 \times \mathbb{RP}^2`$, where $`\mathbb{R}^3`$ gives the
midpoint position and $`\mathbb{RP}^2`$ gives the orientation. A direction is
an element of $`S^2 = \{ x \in \mathbb{R}^3 : \|x\| = 1 \}`$; an orientation
ignores which end is which, giving an element of
$`\mathbb{RP}^2 = S^2 / \{x \sim -x\}`$, the real projective plane. We
estimate the overlap count by histogramming over a discretization of this
space.

**Assumption 2.** No two bonds within a single conformer share a position and
orientation.

**Key observation.** Under this assumption, the bin count equals the number
of conformers contributing that bond.

**Algorithm.** Each bond is mapped to a bin key

$$k(b) = \Bigl(\Bigl\lfloor \mathbf{m}/\varepsilon_p \Bigr\rceil, \Bigl\lfloor \hat{\mathbf{d}}/\varepsilon_d \Bigr\rceil\Bigr)$$

where $`\mathbf{m} \in \mathbb{R}^3`$ is the bond midpoint,
$`\hat{\mathbf{d}} \in \mathbb{RP}^2`$ is represented by the sign-normalized
unit vector, and $`\lfloor \cdot \rceil`$ denotes componentwise rounding. Two
opacities are derived from the resulting histogram:

- **Global opacity** $`\alpha_\text{glob} = \alpha_0 / \max_k n(k)`$ — calibrates the collapsed view.
- **Local opacity** $`\alpha_i = \alpha_0 / \max_{k \in S_i} n(k)`$, where
  $`S_i`$ is the set of bins belonging to object $`i`$ — calibrates each conformer
  independently in the exploded view.