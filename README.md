# Conformer Ensemble Viewer

**Live demo:** https://galmungral.github.io/conformer-viewer/

## Motivation

A molecule is not a fixed geometry but a distribution over conformational
space. This viewer presents the full ensemble at once.

## Approach

Conformers are rendered with additive blending, collapsed onto one another.
Pressing **Space** explodes them into a cubic grid. The transition is animated
so the correspondence between the ensemble and its members is preserved.

## Opacity calibration

Additive blending requires that opacity scale inversely with overlap depth
so that apparent intensity reflects molecular density rather than the size
of the dataset. We determine overlap
by histogramming bonds over a discretized position–direction space. Each bond
is mapped to a bin key

$$k(b) = \Bigl(\bigl\lfloor \mathbf{m}/\varepsilon_p \bigr\rceil,\; \bigl\lfloor \hat{\mathbf{d}}/\varepsilon_d \bigr\rceil\Bigr)$$

where $\mathbf{m}$ is the bond midpoint, $\hat{\mathbf{d}}$ is its canonical
unit direction (sign-normalized so $A \to B$ and $B \to A$ hash identically),
and $\lfloor \cdot \rceil$ denotes rounding to the nearest integer. Because no
two bonds within a single molecule share a bin, the bin count $n(k)$ equals
the number of conformers contributing that bond.

Two opacities are derived from the histogram:

- **Ensemble opacity** $\alpha_\text{ens} = \alpha_0 / \max_k n(k)$, where the
  maximum is taken globally — calibrates the collapsed view.
- **Exploded opacity** $\alpha_i = \alpha_0 / \max_{k \in S_i} n(k)$, where
  $S_i$ is the set of bins belonging to object $i$ — calibrates each conformer
  independently in the exploded view.

This handles dataset heterogeneity: the two included ensembles store geometry
as one `LineSegments` object per conformer and one per ensemble respectively;
the histogram gives consistent results in both cases.
