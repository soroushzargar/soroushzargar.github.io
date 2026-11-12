---
title: Attack a Graph by Evolving Its Edge Flips
date: 2026-11-12
dateDisplay: November 12, 2026
tags: [ICLR 2026, Adversarial Robustness, Graph Neural Networks]
---

This post is about our ICLR 2026 paper, [EvA: Evolutionary Attacks on Graphs](https://arxiv.org/abs/2507.08212), with Mohammad Sadegh Akhondzadeh, Jimin Cao and Aleksandar Bojchevski. A graph neural network can lose much of its accuracy when an attacker flips a few edges. To measure how much, we need to find the worst few flips, and the usual tools for that are a poor fit for the problem.

The plots below are live. Each one starts when it reaches the middle of the screen, and the repeat icon under its corner runs it again. They all run one toy in your browser: a 60-node graph with three communities, where each node mixes its own noisy class probabilities with its neighbours' mean.

## A Few Flips Are Enough

<figure class="plot">
<canvas data-plot="flips" data-scene="eva" role="img" aria-label="A 60-node graph with three communities. Eight flipped node pairs are added one at a time, and accuracy falls from 82 percent to 67 percent as nine more nodes become wrong."></canvas>
<figcaption>Evolution's 8 flips, applied one at a time to the toy graph. Red rings mark nodes the flips turned wrong.</figcaption>
</figure>

## The Gradient Follows the Wrong Thing

An attack picks $k$ node pairs to flip out of about $n^2/2$. Most attacks get there with gradients: they give every pair a weight in $[0, 1]$, climb a differentiable surrogate loss such as cross-entropy, and round back to $k$ flips at the end. Accuracy itself moves in steps, so its gradient is zero almost everywhere. The relaxed problem can have a different answer, and rounding loses more.

In the toy, the flips the gradient picks raise the surrogate loss more than the flips evolution picks. They cost much less accuracy.

<figure class="plot">
<canvas data-plot="surrogate" data-scene="eva" role="img" aria-label="Surrogate loss and accuracy as eight flips are phased in. The gradient's flips reach a surrogate loss of 0.72 but only lower accuracy to 78 percent. Evolution's flips reach 0.59 and lower accuracy to 67 percent."></canvas>
<figcaption>Surrogate loss and accuracy as each attack's 8 flips are turned on gradually (toy).</figcaption>
</figure>

## Search the Discrete Space

EvA drops the relaxation. It is a genetic algorithm whose individuals are sets of $k$ flips. Each generation scores every set by the true objective, keeps the best, makes new sets by crossing over two parents and mutating a few flips, and repeats. Scoring a set takes one forward pass, so the attack needs no gradient and treats the model and the objective as a black box.

<figure class="plot">
<canvas data-plot="generation" data-scene="eva" role="img" aria-label="A population of 24 flip sets sorted by accuracy. Two parents produce a child by crossover and one mutation, and the child is scored. Over 100 generations the best set lowers accuracy from 77 to 67 percent."></canvas>
<figcaption>One generation of a toy genetic algorithm, then a hundred. Each flip set is written as its eight node pairs.</figcaption>
</figure>

Selection keeps what works, crossover combines flips that worked in different sets, and mutation keeps exploring. With the same number of forward passes, evolution finds much stronger flips than random search.

<figure class="plot">
<canvas data-plot="race" data-scene="eva" role="img" aria-label="Lowest accuracy found against model evaluations. After 1,824 evaluations, random search reaches 73 percent and evolution 67 percent, from 82 percent clean. The gradient attack reaches 78 percent."></canvas>
<figcaption>Lowest accuracy found so far, by forward passes spent (toy). The gradient attack is one relax-and-round run, drawn as a line.</figcaption>
</figure>

## What It Buys

Because the objective is a black box, the attacker can aim at anything it can evaluate. We use this for two new attacks: one that weakens robustness certificates, and one that breaks conformal prediction sets. EvA stores each candidate sparsely, as its list of flips, so memory grows only linearly with the budget. A divide-and-conquer strategy takes it to larger graphs, and it improves gradient attacks too. Across our experiments, EvA lowers accuracy by about 11% more on average than the best previous attack.

## A Limitation

Search pays for its strength in model evaluations: every new candidate costs a forward pass, and good attacks need many generations. And like any search, EvA finds strong perturbations without proving that no stronger ones exist. A model that withstands EvA is not certified robust.

The details and full experiments are in the [paper on arXiv](https://arxiv.org/abs/2507.08212), and the abstract is on its [publication page](pub.html?id=eva-2026).
