---
title: Bound the Whole Score Distribution for Smaller Robust Sets
date: 2026-11-12
dateDisplay: November 12, 2026
tags: [ICML 2024, Conformal Prediction, Adversarial Robustness]
---

This post is about our ICML 2024 paper, [Robust Yet Efficient Conformal Prediction Sets](https://arxiv.org/abs/2407.09165), with Mohammad Sadegh Akhondzadeh and Aleksandar Bojchevski. Conformal prediction promises that its prediction set contains the true label with probability at least $1-\alpha$. An adversary who perturbs the input breaks that promise, and earlier robust fixes restore it with large sets.

The plots below run toy models in your browser. Each starts when it reaches the middle of the screen, and the repeat icon runs it again.

## The Guarantee Breaks Under Attack

Conformal prediction gives every label a score for how well it fits the input and keeps the labels whose score clears a threshold. The threshold is a quantile of the true-label scores on a clean calibration set. An attacker lowers the true label's score until it slips below.

<figure class="plot">
<canvas data-plot="attack" data-scene="cas" role="img" aria-label="Histograms of clean calibration scores and attacked test scores with a fixed threshold at 0.50. As the attack radius grows to half the noise level, the test scores slide left and coverage falls from 90.9 percent to 68.3 percent, below the 90 percent target."></canvas>
<figcaption>A fixed threshold and a growing attack (toy model).</figcaption>
</figure>

## Use the Whole Distribution

To limit what an attack can do, we smooth the score: it becomes the average score under Gaussian noise of scale $\sigma$. Randomized smoothing then bounds how far that average can fall when the input moves by at most $r$ in $\ell_2$. Earlier robust conformal prediction (RSCP) applies the bound to the mean. For a score in $[0,1]$ with smoothed value $p$, the worst case is at least $\Phi(\Phi^{-1}(p) - r/\sigma)$.

The mean throws away the rest of the noisy scores. The same rule holds at every level $t$: the chance $p_t$ that the noisy score exceeds $t$ can fall at most to $\Phi(\Phi^{-1}(p_t) - r/\sigma)$. The mean is the area under these chances, so we bound each one and add them up:

$$\underline{s} = \int_0^1 \Phi\left(\Phi^{-1}(p_t) - r/\sigma\right) \mathrm{d}t$$

This is CAS, for CDF-aware sets. The rule is convex in the probability, so by Jensen's inequality, bounding level by level is never looser than bounding the mean. The gain is largest when the noisy scores are concentrated.

<figure class="plot">
<canvas data-plot="cdf" data-scene="cas" role="img" aria-label="The chance that one point's noisy score exceeds each level, before and after the worst-case push at r over sigma of 0.5. The area drops from 0.60 to 0.47 for the CDF-aware bound, while the mean-only bound gives 0.41."></canvas>
<figcaption>One test point. The area under the curve is its smoothed score (toy model).</figcaption>
</figure>

## Shift the Threshold Once

We can spend the bound at calibration time. Each calibration score is replaced by its worst-case lower bound, and the threshold is the quantile of those. An attacked test point then clears the lower threshold with probability at least $1-\alpha$, so at test time we only compute the smoothed score, with no certificate per test point.

<figure class="plot">
<canvas data-plot="calib" data-scene="cas" role="img" aria-label="Calibration scores slide to their CDF-aware lower bounds and the threshold follows from 0.50 to 0.37. Coverage of the attacked test scores rises from 81.4 percent to 90.9 percent, above the 90 percent target."></canvas>
<figcaption>Calibration scores move to their bounds and the threshold follows (toy model).</figcaption>
</figure>

## What It Buys

A tighter bound lowers the threshold less, so fewer wrong labels clear it. With the same guarantee, CAS sets are smaller than mean-based ones, and the gap grows with the radius. The paper also covers poisoning of the calibration data, in features and labels, and sparse discrete inputs.

<figure class="plot">
<canvas data-plot="size" data-scene="cas" role="img" aria-label="Average set size against attack radius. Standard conformal prediction stays at 2.3 labels but is not robust. At r over sigma of 1, the mean-only bound needs 6.4 labels and the CDF-aware bound 4.8, both keeping coverage at or above 90 percent under attack."></canvas>
<figcaption>Average set size on clean test inputs, out of ten labels (toy model).</figcaption>
</figure>

## The Cost

Smoothing is expensive. Each smoothed score averages many noisy forward passes, and the sets must also absorb the error of that Monte Carlo estimate, which inflates them most when the sample budget is small.

The details and experiments are in the [paper on arXiv](https://arxiv.org/abs/2407.09165), and the abstract is on its [publication page](pub.html?id=robust-efficient-2024).
