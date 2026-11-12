---
title: One Sample is Enough to Make Conformal Prediction Robust
date: 2025-12-15
dateDisplay: December 15, 2025
tags: [NeurIPS 2025, Conformal Prediction, Adversarial Robustness]
---

This post is about our NeurIPS 2025 paper with Mohammad Sadegh Akhondzadeh and Aleksandar Bojchevski. Robust conformal prediction usually needs many forward passes for every input. We show that one pass on a noisy copy of the input is enough.

The plots below run small toy models in your browser. Each one starts when it reaches the middle of the screen, and the repeat icon runs it again.

## The Problem

Conformal prediction returns a set of labels that contains the true label with probability at least $1-\alpha$. An attacker who moves the test input a little can break that guarantee.

The usual repair is randomized smoothing. We replace the model's score by its average over Gaussian noise, which changes slowly enough to certify. Estimating that average takes many noisy forward passes for every calibration and test input. The methods we compare to use around 100.

<figure class="plot">
<canvas data-plot="passes" data-scene="rcp1" role="img" aria-label="Two panels score the same input of a three-class toy problem. Monte Carlo smoothing adds 100 noisy copies and needs 100 forward passes for one averaged score. The single-sample method draws one noisy copy and needs 1 forward pass."></canvas>
<figcaption>Scoring one input of a toy three-class problem: average over 100 noisy copies, or use one.</figcaption>
</figure>

## The Idea

We skip the average. Each input gets one noisy copy $x + \varepsilon$ with $\varepsilon \sim \mathcal{N}(0, \sigma^2 I)$, and its score is $s(x + \varepsilon, y)$. The noise is drawn independently for every point, so calibration and test scores stay exchangeable. Ordinary conformal prediction on these scores is valid as it is.

<figure class="plot">
<canvas data-plot="calib" data-scene="rcp1" role="img" aria-label="Histogram of 2000 calibration scores, each from one noisy copy, with the threshold below which 10 percent of them fall. Then 2000 test inputs with one noisy copy each arrive, and their coverage settles at about 90 percent."></canvas>
<figcaption>Calibration and test scores from one noisy copy each. The usual quantile gives about 90% coverage (toy model).</figcaption>
</figure>

## Why It Works

The noise does a second job. Whether the true label lands in the set is now a random event, and its probability over the noise cannot change abruptly when the input moves. Smoothing certificates bound exactly this kind of probability. For Gaussian noise, a probability $p$ can fall at most to $\Phi(\Phi^{-1}(p) - r/\sigma)$ under an $\ell_2$ shift of size $r$.

So we certify the conformal procedure as a whole, instead of each score. If the sets cover with probability $1-\alpha'$ on clean data, they cover with at least $\Phi(\Phi^{-1}(1-\alpha') - r/\sigma)$ under attack. We pick the calibration level so that this worst case is still $1-\alpha$:

$$1-\alpha' = \Phi\left(\Phi^{-1}(1-\alpha) + r/\sigma\right)$$

<figure class="plot">
<canvas data-plot="certify" data-scene="rcp1" role="img" aria-label="Coverage against attack radius. Plain conformal prediction falls below the 90 percent target under a toy attack. Raising the calibration level from 90 to about 96 percent lifts the certified bound to exactly 90 percent at the design radius r over sigma of 0.5, and the attacked coverage of RCP1 stays above the target up to that radius."></canvas>
<figcaption>Coverage of the toy procedure under a gradient attack. Calibrating higher lifts the certified bound to the target at the design radius.</figcaption>
</figure>

## What It Buys

One forward pass per input, at calibration and at test time. The argument works with any binary certificate, not only the Gaussian one, and with classification or regression. In the paper, RCP1 gives smaller average sets than state-of-the-art methods that use about 100 passes per input. We also extend it to robust conformal risk control.

## The Limitation

Robustness is paid for in set size. The bound sees only the clean coverage, so a larger radius needs a higher calibration level, and the level approaches 100% as $r/\sigma$ grows. The sets then grow toward the full label set, and the guarantee covers only the threat model of the certificate.

<figure class="plot">
<canvas data-plot="price" data-scene="rcp1" role="img" aria-label="Bar chart of the average set size of the toy model when calibrated for attack radii 0, 0.25, 0.5 and 0.75 times sigma. The calibration level rises from 90 percent and the sets grow with it."></canvas>
<figcaption>Average set size of the toy model, calibrated for larger radii.</figcaption>
</figure>

The proofs, the regression case and the experiments are in the [paper on arXiv](https://arxiv.org/abs/2506.16553), and the abstract is on its [publication page](pub.html?id=one-sample-2025).
