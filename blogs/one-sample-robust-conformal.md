---
title: One Sample is Enough to Make Conformal Prediction Robust
date: 2025-12-15
dateDisplay: December 15, 2025
tags: [NeurIPS 2025, Conformal Prediction, Adversarial Robustness]
---

This post is about our NeurIPS 2025 paper, where we show that a **single adversarial example per calibration point** is enough to build conformal prediction sets with valid coverage guarantees under adversarial attack.

## The Problem

Conformal prediction provides a clean, distribution-free guarantee: the prediction set contains the true label with at least $1 - \alpha$ probability. But this guarantee breaks under adversarial perturbations. An attacker who shifts the test input by even a small $\ell_\infty$ or $\ell_2$ perturbation can reliably push the true class out of the prediction set.

Prior work on *adversarially robust conformal prediction* restores the guarantee by searching over all perturbations in the threat model for each calibration point — finding the **worst-case nonconformity score** before computing the quantile threshold. This works, but the cost is prohibitive: for a budget of $\epsilon$ under randomized smoothing, you may need thousands of forward passes per calibration point.

## The Insight

The key observation is simple: you do not need the worst case. You need something that is *bad enough* to push the quantile up by the right amount.

We show that augmenting each calibration score $s_i$ with the score of a **single adversarial example** $\tilde{x}_i$ — obtained by one step of PGD — is sufficient. The resulting threshold, computed from the pooled set of $2n$ scores, satisfies:

$$\Pr(s(X_{n+1}, Y_{n+1}) \leq \hat{q}) \geq 1 - \alpha$$

under the adversarial threat model, with no additional assumptions beyond exchangeability of the augmented scores.

The argument is a careful application of the standard conformal coverage proof to the augmented calibration set. Because the adversarial example for each point is generated independently, the augmented sequence remains exchangeable. And because the adversarial perturbation moves in the direction of increasing nonconformity score, the single-step attack is already a good proxy for the worst case in practice.

## Why It Matters

The practical gain is significant. Where prior methods require $O(m)$ forward passes per calibration point (with $m$ on the order of hundreds to thousands for tight certificates), our method requires exactly **two** — one clean, one adversarial. This reduces calibration cost by $1$–$3$ orders of magnitude depending on the budget and architecture.

Coverage quality is comparable. On ImageNet with a ResNet-50 backbone under $\ell_\infty$ perturbations, the prediction sets produced by our method are within a few percentage points of the tightest sets from full worst-case calibration, while running roughly $500\times$ faster.

## Takeaway

Adversarial robustness in conformal prediction has often been framed as a tension between validity and computational cost. This paper shows the tension is largely illusory: **one adversarial sample per calibration point is enough**, and it is cheap to generate. The approach works across $\ell_\infty$ and $\ell_2$ threat models with no change to the algorithm.

The paper is available on arXiv and was presented at NeurIPS 2025 in Vancouver.
