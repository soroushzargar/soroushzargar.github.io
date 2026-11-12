---
title: Let the Neighbours Shape the Prediction Set
date: 2026-11-12
dateDisplay: November 12, 2026
tags: [ICML 2023, Conformal Prediction, Graph Neural Networks]
---

This post is about our ICML 2023 paper, [Conformal Prediction Sets for Graph Neural Networks](https://proceedings.mlr.press/v202/h-zargarbashi23a.html), with Simone Antonelli and Aleksandar Bojchevski. A graph neural network labels the nodes of a graph, and conformal prediction turns its outputs into sets of labels that contain the true one with a chosen probability. The standard recipe scores each node on its own, so the sets are often larger than they need to be.

The plots below run small toy models in your browser. Each one starts when it reaches the middle of the screen, and the repeat icon under its corner runs it again.

## Ask the Neighbours

Conformal prediction gives every node a score for every class. Labelled calibration nodes fix a threshold that 90% of them clear with their true class, and a test node's set keeps every class above that threshold.

In many graphs, connected nodes tend to share a label. This is homophily. Our method, DAPS (Diffusion Adaptive Prediction Sets), uses it after the model has made its predictions. Each node's score for a class is mixed with the average score its neighbours give that class:

$$\hat s(v, y) = (1 - \lambda)\cdot s(v, y) + \frac{\lambda}{|\mathcal N(v)|} \sum_{u \in \mathcal N(v)} s(u, y)$$

Then we calibrate on the mixed scores as usual. A node that is unsure on its own gets help from neighbours that are more certain.

<figure class="plot">
<canvas data-plot="pull" data-scene="daps" role="img" aria-label="A node v whose own top class is wrong has the set {A, C}. As lambda rises to 0.76, its scores move toward the mean of its five neighbours, the threshold is recalibrated, and the set shrinks to {C}, the true label."></canvas>
<figcaption>One node's scores, its neighbours' mean, and the mix as λ rises. Filled bars are in the set (toy graph).</figcaption>
</figure>

## Why Coverage Holds

The guarantee of conformal prediction needs calibration and test nodes to be exchangeable. In the transductive setting the whole graph is there from the start, and a GNN applies the same rule to every node, so calibration and test nodes are exchangeable. Diffusion keeps this. It reads scores only, needs no labels, and treats every node by the same rule. So the guarantee holds for every $\lambda$.

<figure class="plot">
<canvas data-plot="splits" data-scene="daps" role="img" aria-label="Coverage over 150 random calibration splits, one dot per split. Standard conformal prediction and DAPS both scatter around the 90 percent target, with means of 89.8 and 90.1 percent."></canvas>
<figcaption>Coverage across random calibration splits, with and without diffusion (toy graph).</figcaption>
</figure>

## What It Buys

The method wraps around any trained GNN without retraining it. In the paper, the sets have comparable or smaller average size than standard conformal prediction, and many more of them are correct sets of size one. In the toy graph, both happen at once.

<figure class="plot">
<canvas data-plot="shrink" data-scene="daps" role="img" aria-label="A patch of the toy graph, each test node drawn as a pie of the classes in its set. As lambda rises from 0 to 0.76, average set size falls from 2.00 to 1.35 and correct singletons rise from 20 to 58 percent, while coverage stays near 91 percent."></canvas>
<figcaption>Prediction sets on a patch of the graph as λ rises. Readouts cover all test nodes (toy graph).</figcaption>
</figure>

## The Catch

The gain rests on homophily. If a node's neighbours tell us nothing about its label, their average adds noise, and the sets grow. Coverage still holds, but we pay in size. The paper studies conditions under which this kind of smoothing provably helps.

<figure class="plot">
<canvas data-plot="homophily" data-scene="daps" role="img" aria-label="Average set size against lambda. When neighbours share labels, size falls from 1.96 to about 1.27 near lambda 0.76. With random neighbours, size rises to 2.67 at lambda 1. Coverage stays near 90 percent on both."></canvas>
<figcaption>Average set size against λ, on the toy graph and on the same nodes with random edges.</figcaption>
</figure>

On a graph, a node's neighbours are free evidence about its label, and conformal prediction can use that evidence without losing its guarantee.

The full method and experiments are in the [paper](https://proceedings.mlr.press/v202/h-zargarbashi23a.html), and the abstract is on its [publication page](pub.html?id=conformal-gnn-2023).
