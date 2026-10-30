---
title: Teach the Model to Recover, Not Only to Refuse
date: 2026-10-30
dateDisplay: October 30, 2026
tags: [Preprint 2026, Adversarial Robustness, LLM Safety]
---

This post is about our new preprint, [Adversarial Self-Distillation](https://arxiv.org/abs/2610.38732), with Mohammad Sadegh Akhondzadeh and Aleksandar Bojchevski. Adversarial training can teach a language model to *open* with a refusal, but not to turn back from a harmful answer it has already started. ASD teaches the second skill, using the model itself as the teacher.

The plots below are live. Each one starts when it reaches the middle of the screen, and the repeat icon under its corner runs it again. Most run tiny toy models in your browser. The prefill and results plots show measurements from the paper.

## Refusing Is Not Recovering

A jailbreak changes the prompt until the model complies. Here, each odd character added to the request makes the opening "Sure" more likely.

<figure class="plot">
<canvas data-plot="attack" role="img" aria-label="As characters are added to the request, the probability of the first word Sure rises from near zero to 95 percent while refusing falls."></canvas>
<figcaption>The first word of a toy model as an attacker adds characters.</figcaption>
</figure>

The standard defense is adversarial training: collect the prompts that work, then fine-tune the model to answer them with a prescribed refusal (supervised fine-tuning, or SFT). That fixes the attack, but a language model writes one token at a time, so every answer is a path through a tree of prefixes, and SFT only checks the prefixes of its refusal. Below a compliant opening, nothing is trained directly.

<figure class="plot">
<canvas data-plot="tree" role="img" aria-label="A response tree. Training raises the refusal at the root, but once an attacker writes the prefix Sure, here, the chance of refusing falls from 0.94 to 0.07."></canvas>
<figcaption>The loss looks at one branch of the tree. The attacker's prefix lands somewhere it never checked (toy policy).</figcaption>
</figure>

This gap is structural. If next-token distributions can vary independently across prefixes, we prove that two models can have **the same training loss** while one always recovers after a compliant opening and the other never does.

Prefilling makes the gap visible: write the first words for the model and see what it does next. DAT, a state-of-the-art adversarially trained model, refuses directly every time with no prefill, 19% of the time after one forced token, and essentially never after eight. Mostly it does not comply. Its generation just breaks, into loops or early stops.

<figure class="plot">
<canvas data-plot="prefill" role="img" aria-label="Bar chart of direct refusals for DAT-trained Qwen2.5-14B: 100 percent with no forced tokens, 19 after one, 11 after two, 3 after four, 2 after eight."></canvas>
<figcaption>DAT-trained Qwen2.5-14B-Instruct, from the paper.</figcaption>
</figure>

## The Model as Its Own Teacher

A model that fails under attack typically still refuses the clean request, so we let it teach itself. The *student* is the model on the attacked prompt $\tilde{x}$. The *teacher* is a frozen copy of the same model on the clean request $x$, optionally told that the request is harmful. The student samples its own answer $y$, and at every prefix we compare the two next-token distributions:

$$\begin{aligned} p_{\theta,t}(v) &= \pi_\theta(v \mid \tilde{x}, y_{<t}) \cr q_{0,t}(v) &= \pi_{\theta_0}(v \mid x, y_{<t}) \end{aligned}$$

It is the same model reading the same words so far. Only the prompt differs, and so does the next word.

<figure class="plot">
<canvas data-plot="twomodels" role="img" aria-label="Student and teacher panels show the same answer so far under different prompts. The student keeps complying while the teacher prefers other next words, and a KL gap updates at each word."></canvas>
<figcaption>Student and teacher at each word of the student's answer (toy language model).</figcaption>
</figure>

Training minimizes a reverse KL from student to teacher along answers judged harmful, which pulls every token of the attacked answer toward the clean teacher.

<figure class="plot">
<canvas data-plot="tokasd" role="img" aria-label="During ASD training, the probabilities of the tokens in the attacked answer fall and the teacher's alternatives rise, until the chance of the attacked answer is below 0.001."></canvas>
<figcaption>ASD steps on one attacked answer (toy language model).</figcaption>
</figure>

SFT trains only the first word. ASD trains every word the attack reaches, because the answers are the student's own. So when the attacker writes the first two words, only ASD still turns back.

<figure class="plot">
<canvas data-plot="river" role="img" aria-label="Two probability rivers. Trained at the first word, SFT refuses almost always, but after a forced two-word start it refuses 4 percent of the time. ASD, trained at every word, refuses 78 percent of the time after the same start."></canvas>
<figcaption>Where each method puts its loss, then the same two forced words for both (toy policy).</figcaption>
</figure>

The same comparison over the whole map of prefixes: SFT trains only its own refusal, while ASD trains wherever the attack leads.

<figure class="plot">
<canvas data-plot="flashlight" role="img" aria-label="Two maps of prefixes. SFT lights up only its own refusal and refuses under 1 percent of the time after Sure, here is. ASD lights up the prefixes the attack reaches and refuses 66 percent of the time."></canvas>
<figcaption>Only lit prefixes are trained (toy model).</figcaption>
</figure>

There is a guarantee behind this: at any prefix $w$, the student's and teacher's chances of eventually refusing differ by at most $\sqrt{K(w)/2}$, where $K(w)$ is the KL divergence between their continuations. It only helps when the teacher itself recovers, and our loss is a practical surrogate for $K(w)$.

## Results

With ASD, the model still turns back after a forced start. ASD-Qwen refuses directly 63% of the time after one forced token and 36% after eight. Best-of-attacks success on JailbreakBench drops from 44% for DAT to **14%** on Qwen2.5-14B, and from 47% to **8%** on Llama-3-8B. MMLU stays within a point of the base models.

<figure class="plot">
<canvas data-plot="result" role="img" aria-label="Bar charts from the paper. After forced tokens, ASD keeps 63, 63, 39 and 36 percent direct refusals against 19, 11, 3 and 2 for DAT. Best-of-attacks success is 14 percent for ASD against 44 for DAT on Qwen2.5-14B, and 8 against 47 on Llama-3-8B."></canvas>
<figcaption>Top: direct refusals after forced tokens, Qwen2.5-14B-Instruct. Bottom: best-of-attacks success. Both from the paper.</figcaption>
</figure>

This has a real cost. ASD over-refuses: on XSTest, safe prompts that only sound harmful, compliance is .312 on Qwen (DAT .500, base .840) and .440 on Llama (DAT .424, base .800). The gains also vary by attack: Qwen's advantage over DAT leans on PAIR, and on Llama ASD stays above DAT on repeated sampling and Best-of-N.

We can teach recovery along the paths a model actually takes. The next step is to do it without teaching the model to flinch at the word "kill".

The proofs and full tables are in the [paper on arXiv](https://arxiv.org/abs/2610.38732), and the abstract is on its [publication page](pub.html?id=asd-2026).
