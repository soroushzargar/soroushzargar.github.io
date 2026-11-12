---
title: Binarize the Score, Then Certify Once
date: 2026-11-12
dateDisplay: November 12, 2026
tags: [ICLR 2025, Conformal Prediction, Adversarial Robustness]
---

This post is about our ICLR 2025 paper, [Robust Conformal Prediction with a Single Binary Certificate](https://arxiv.org/abs/2503.05239). We make conformal prediction sets robust to small input perturbations with far fewer model calls. The trick is to turn the score into a yes-or-no question before smoothing it.

The plots below are live. Each one starts when it reaches the middle of the screen, and the repeat icon under its corner runs it again. All of them run a toy model in your browser.

## The Problem

Conformal prediction returns a set of labels that contains the true one with probability at least $1-\alpha$. An attacker who moves the input slightly can break that guarantee.

The usual repair is randomized smoothing. We average the conformal score over Gaussian noise and bound how far that average can move. The average is estimated from Monte Carlo samples, so these methods need many samples per input, and they compute a certificate for every point.

## The Idea

We call our method BinCP. We binarize first. Fix a threshold $\tau$, add noise to the input many times, and ask for each noisy copy whether the score of a label clears $\tau$. What smoothing keeps is one probability:

$$\bar{s}(x, y) = \Pr_{\epsilon}\big[ s(x+\epsilon, y) \ge \tau \big], \qquad \epsilon \sim \mathcal{N}(0, \sigma^2 I).$$

The prediction set holds the labels with $\bar{s}(x,y) \ge p$. We fix one of $p$ and $\tau$ and calibrate the other, so that the true label makes it into the set for a $1-\alpha$ fraction of calibration points.

<figure class="plot">
<canvas data-plot="binarize" data-scene="bincp" role="img" aria-label="Sixty noisy copies of one input are scored and stacked along a score axis. A threshold tau at 0.45 splits them into 55 copies that clear it and 5 that do not, so the estimated probability is 0.92."></canvas>
<figcaption>Each noisy copy only answers yes or no. The whole score distribution becomes one count (toy classifier).</figcaption>
</figure>

## Why It Works

Now $\bar s$ is the probability of a binary event under Gaussian noise. For such a probability there is a classic bound: if it is at least $p$ at $x$, then at any $\tilde{x}$ with $\lVert \tilde{x} - x \rVert_2 \le r$ it is at least

$$p' = \Phi\big(\Phi^{-1}(p) - r/\sigma\big).$$

This bound depends only on $p$, and $p$ is the same for every input and every label. So we compute it once. At test time the set holds the labels with $\bar s(\tilde x, y) \ge p'$. If the true label cleared $p$ on the clean input, it still clears $p'$ on the attacked one, and the coverage guarantee carries over.

<figure class="plot">
<canvas data-plot="certify" data-scene="bincp" role="img" aria-label="As the radius grows to half of sigma, the worst-case curve bends and the level 0.90 drops to 0.78. The true label cat has probability 0.92 at the clean input and 0.87 at an attacked one, below 0.90 but above 0.78, so the robust set is the set containing cat alone."></canvas>
<figcaption>Left: the worst case of a clean probability as the radius grows. Right: the attacked input's labels, against the level read off on the left (toy classifier).</figcaption>
</figure>

## What It Buys

We still estimate $\bar s$ from samples, and the guarantee needs a margin for that error. For a Bernoulli probability we can use the exact Clopper–Pearson interval. It is much tighter than the generic bounds for the mean of a bounded score, especially near 0 or 1. The score also no longer needs to be bounded. In the paper, about 150 Monte Carlo samples per input already give small robust sets on CIFAR-10, where earlier methods often use around $10^4$.

<figure class="plot">
<canvas data-plot="samples" data-scene="bincp" role="img" aria-label="Confidence intervals narrow as samples arrive. The mean score with a Hoeffding interval reaches a margin of 0.05 at 738 samples. The share of copies above tau, with a Clopper-Pearson interval, reaches it at 128 samples."></canvas>
<figcaption>Two 95% intervals from the same noisy copies of one input, until each is within ±0.05 (toy classifier).</figcaption>
</figure>

## The Limitation

BinCP still smooths. Each prediction costs about 150 forward passes, far more than plain conformal prediction needs. The guarantee also covers only the threat model of the noise. Here that is an $\ell_2$ ball under Gaussian noise, and the sets grow as $r/\sigma$ grows.

The proofs and experiments are in the [paper on arXiv](https://arxiv.org/abs/2503.05239), and the abstract is on its [publication page](pub.html?id=single-cert-2025).
