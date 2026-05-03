# Conformer Ensemble Viewer

**Live demo:** https://galmungral.github.io/conformer-viewer/

## Motivation

A conformer ensemble is a set of three-dimensional geometries of the same
molecule. This viewer renders all conformers simultaneously.

## Approach

Conformers are rendered with additive blending, collapsed onto one another.
Pressing **Space** explodes them into a cubic grid. The transition is animated
so the correspondence between the ensemble and its members is preserved.

## Opacity calibration

Additive blending requires that opacity scale inversely with overlap depth,
so that apparent brightness reflects how frequently a bond appears at a given
location across the ensemble rather than how many conformers the dataset
contains.

Each bond occupies a point in $`\mathbb{R}^3 \times \mathbb{RP}^2`$, where
$`\mathbb{R}^3`$ gives the midpoint position and $`\mathbb{RP}^2`$ gives the
undirected bond orientation. Here $`S^2 = \{ x \in \mathbb{R}^3 : \|x\| = 1 \}`$
is the unit sphere and $`\mathbb{RP}^2 = S^2 / \{x \sim -x\}`$ is the
real projective plane, obtained by identifying antipodal points. We estimate
overlap depth by histogramming over a discretization of this space. Each bond
is mapped to a bin key

$$k(b) = \Bigl(\Bigl\lfloor \mathbf{m}/\varepsilon_p \Bigr\rceil, \Bigl\lfloor \hat{\mathbf{d}}/\varepsilon_d \Bigr\rceil\Bigr)$$

where $`\mathbf{m} \in \mathbb{R}^3`$ is the bond midpoint,
$`\hat{\mathbf{d}} \in \mathbb{RP}^2`$ is represented by the sign-normalized
unit vector (so $`A \to B`$ and $`B \to A`$ hash identically), and
$`\lfloor \cdot \rceil`$ denotes componentwise rounding. The bin count $`n(k)`$
measures overlap depth at position $`k`$.

Two opacities are derived from the histogram:

- **Global opacity** $`\alpha_\text{glob} = \alpha_0 / \max_k n(k)`$ — calibrates the collapsed view.
- **Local opacity** $`\alpha_i = \alpha_0 / \max_{k \in S_i} n(k)`$, where
  $`S_i`$ is the set of bins belonging to object $`i`$ — calibrates each conformer
  independently in the exploded view.