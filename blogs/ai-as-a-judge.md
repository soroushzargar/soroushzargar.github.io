---
title: For and Against an AI becoming a Judge, or a Policy Maker
date: 2026-08-14
dateDisplay: August 14, 2026
tags: [Essay, AI Governance, Fairness]
---

What would justify outsourcing human judgement to an artificial intelligence?

Some years from now, an artificial intelligence system outperforms the best human judges, in the same that it did in many other tasks. This performance is perhaps compared over a large dataset made of carefully designed trials. In practice, that machine might make fewer factual errors, and make decisions that are overturned less often. Machines can also self-improve and adapt, and produces smaller disparities across demographic groups (and be more fair). They work in seconds not months, and they more available to both parties, and cost a fraction of today's courts. If such a miraculous system exists, then, would it justify letting them replace a human in the power of judgement? If no, what makes such task more difficult?

For start, judgement is a safety-critical domain, meaning that a mistake is severely more harmful. A mistake of an image classifications model in your photos app is at most a little annoying, while a mistake in a medical diagnosis can cost a life. Same for a mistake in judicial system: Court, is a place where public power is exercised over particular people. A judgment may take away liberty, separate a family, deny refuge, redistribute property or attach to a person the official name of a crime. Another distinction is that judicial decisions are not forecasts over a solid ground truth; in other words, despite many cases where machines are used, the environment is not fixed. The machine, or judges decision will alter the environment. The relevant question is therefore not only whether a machine can reach better answers. It is whether statistical superiority leads to a better evolution of the world; something that is not commonly a performance indicator in many other tasks, and something that is so expensive to do A/B test on.

This distinction is easily lost because artificial intelligence has trained us to think in benchmarks, and benchmarks are marginal by nature - they sum up all the cases into a single number. Images receive labels, translations are compared with reference texts, predictions are scored against later events, and performance across many examples is compressed into accuracy, expected loss or some other aggregate. That compression is useful precisely because the individual example usually matters less than the distribution.

In safety critical domain, each mistake should be considered a potential disaster, and every mistake should be individually studied. A court with a 99 per cent success rate may sound exemplary, but no defendant experiences 99% of a court. There is always some person that feels the harm of that 1%. Think of any airplane accident, we investigate each and everyone, and design protocols that ensure us, that specific case doesn't happen ever again. The same applies with our retrospective view of legal cases. In short what we need is for the model to be trustworthy, and not only accurate. We should know whether these models burden some groups disproportionately, whether they are aware of their uncertainty and whether a person can discover and correct what went wrong.

## But where it can really be better?

An argument which is the very common in any automation proposal is that the machine does not suffer from fatigue, personal prejudice, and emotional reactions. But in this use case there is even a much more important justification. Every decision of a machine can be reproduced. Every argument can be tested, and redrawn. Reproducibility is the key to enhancement. You can not ask the judge to clear their mind and decide on the case once again, and even worse, you can not ask the judge to imagine if the defendant is of another demographic group. This point alone means that you can not run counterfactual examples over a judge and as a human being you might never be able to detect if they are deciding unfairly looking at a sensitive attribute like gender or ethnicity.

Another important factor is availability. Every human judge has a capacity to hear the parties, and discussing above that capacity can overwhelm a human being. This means that there would always be cases where parties think they could have presented themselves better. AI as a judge provides the chance to retry. Every party of the court can resubmit their response and even evaluate the presentation of their arguments. Therefore in some sense it can bring a procedural fairness, as everyone is given chances to retry, and by enough effort, no one is under-represented. This is also somehow the best-practices developed by lawyers as they try to represent their client in a way that the facts are more effective in the court. In a world with machine judges, this becomes a hybrid of tech and humanity in collaboration.

Most importantly, we can build a protocol around it. Let's say the judge is a machine. Then a government that aims towards a better and a more fair approach to governance, has the opportunity to provide an API to this judge. In some sense, making the judge open-source. This can allow research teams in law, and technology to stress-test this judge. See if the judge can be misled by presentations, or if an adversarial suffix can toggle the judge's prediction. If the law is fully trained in the parameters of the model, and if it can fully follow it through edge cases. This is not even close to happen for human judges. The system can improve much more rapidly, since the teams have access to such an open access judge. Interestingly, a government can release beta versions of the new updated judge and let the community run stress-tests and benchmarking.

An important bias is removed from the judgement; the judge themself! The final judgement, is conditioned to the case, the defendant, and of course the judge! Judges, can be tired, exhausted, or happy; they can have bias based on ethnicity, gender, and many other irrelevant factors. Of course they practice not to bring those factors into play, but no one is 100% immune to such priors. Therefore there might be cases where the parties think "if instead of this judge there was someone else, the outcome might have ended up differently". This sentence alone means that there is a parameter in the judgement, which is irrelevant to the truth. Machine helps us to eliminate such parameters.

## All above points ignore the nature of judgement

Legal judgement occupies a more ambiguous territory. Courts do not only determine facts. They interpret principles, balance competing interests, and decide how abstract values should apply to specific human circumstances. There are many cases where a judge escalates the case only to include more nuanced interpretation of the same law they practice. Some cases can force the judges to ask for revisions over the law. Therefore purely relying on the statistical patterns are not sufficient to perform a judgement, as the ground truth is not discovered fully, and we are exploring it through different cases. The background science is not solid, and it reforms itself over time.

### The data, is a legacy of bias

The difficulty becomes even greater when we examine the data from which such systems would learn. Throughout the history, we have progressively built a higher moral standard. This means that training from a historical data would reproduce judgements that we would avoid today. Another effect of automation is that we would lose the chance of rethinking our laws and decisions, in face of the novel and complicated cases, as we are automating the judgement.

A judicial dataset does not tell us what justice required in every possible situation. It tells us what happened after judges, prosecutors, lawyers, and institutions made choices under particular historical conditions. Consider a simple example: predicting whether a defendant should be released before trial. A machine learning model can examine thousands of previous cases. It can observe who was released, who was detained, and what happened afterward. But there is a fundamental missing piece: for the people who were detained, we do not know what would have happened if they had been released. And of course there is also a significant bias in the history. What if a certain ethnicity was unjustly detained more often than the others? Then the machine learn the ethnicity as a shortcut to increase its benchmark performance which is not what justice is meant to do.

### The alternative future does not exist in the dataset

This is one of the central problems in applying artificial intelligence to human decision-making. The data reflects not only reality but also the decisions that shaped reality. It is like looking at a situation without knowing what brought us to it. The system learns from a world that has already been filtered through human judgement. Therefore, an AI system may become extremely good at predicting the decisions of judges without necessarily becoming better at understanding justice itself. It may learn the behaviour of the institution without learning whether the institution's behaviour was correct. We can perhaps say that there is no single legal equivalent of the correct label on an image. There is no correct label; the label is what we believe under the morality that is also evolving over time.

This is why claims about an AI "outperforming judges" need to be read carefully. A prominent retrospective study of bail decisions estimated that, at the same detention rate, a machine policy might have reduced crime by as much as 24.7 per cent, or, without increasing crime, reduced detention by as much as 41.9 per cent. Those are striking estimates. They are not the result of a court actually surrendering its bail decisions to a machine. They depend on counterfactual methods for inferring what would have happened under a different policy. They show that human decisions may leave large gains unrealized; they do not by themselves prove that an automated institution would deliver those gains in practice.

The ultimate test of an artificial judge is therefore not whether it can produce the right answer more often than a human being. It is whether the institution built around it protects the human ability to understand, challenge and sometimes transform the terms on which any answer can be called just.

## References, and follow up readings

[¹] Jon Kleinberg, Himabindu Lakkaraju, Jure Leskovec, Jens Ludwig and Sendhil Mullainathan, ["Human Decisions and Machine Predictions"](https://www.nber.org/papers/w23180), *Quarterly Journal of Economics* 133(1), 2018; Himabindu Lakkaraju et al., ["The Selective Labels Problem"](https://pmc.ncbi.nlm.nih.gov/articles/PMC5958915/), KDD 2017.

[²] Kleinberg et al., ["Human Decisions and Machine Predictions"](https://pmc.ncbi.nlm.nih.gov/articles/PMC5947971/). The estimated ranges reported by the authors are a crime reduction of 14.4–24.7 per cent at the same detention rate, or a detention reduction of 18.5–41.9 per cent without increasing crime.

[³] Kosuke Imai et al., ["Experimental Evaluation of Algorithm-Assisted Human Decision-Making: Application to Pretrial Public Safety Assessment"](https://academic.oup.com/jrsssa/article/186/2/167/7024674), *Journal of the Royal Statistical Society: Series A* 186(2), 2023.

[⁴] Shantanu Khanna, Jens Ludwig, Sendhil Mullainathan and Ashesh Rambachan, ["Algorithmic Recommendations and Human Discretion"](https://www.nber.org/papers/w31747), NBER Working Paper 31747, 2023.

[⁵] Jaya Ramji-Nogales, Andrew I. Schoenholtz and Philip G. Schrag, ["Refugee Roulette: Disparities in Asylum Adjudication"](https://scholarship.law.georgetown.edu/facpub/1902/), *Stanford Law Review* 60, 2007.

[⁶] International Telecommunication Union, [*Facts and Figures 2025*](https://www.itu.int/itu-d/reports/statistics/facts-figures-2025/), 2025.

[⁷] Council of Europe, [*Framework Convention on Artificial Intelligence and Human Rights, Democracy and the Rule of Law*](https://www.coe.int/en/web/artificial-intelligence/the-framework-convention-on-artificial-intelligence), opened for signature 5 September 2024.

[⁸] National Institute of Standards and Technology, [*Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations*](https://www.nist.gov/news-events/news/2025/03/nist-trustworthy-and-responsible-ai-report-adversarial-machine-learning), NIST AI 100–2e2025, 2025.

[⁹] European Union, [Regulation (EU) 2024/1689 (Artificial Intelligence Act)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689), recital 61 and Annex III.

[¹⁰] UNESCO, [*Guidelines for the Use of AI Systems in Courts and Tribunals*](https://www.unesco.org/en/articles/guidelines-use-ai-systems-courts-and-tribunals), 2025.

[¹¹] European Commission for the Efficiency of Justice, [*European Ethical Charter on the Use of Artificial Intelligence in Judicial Systems and Their Environment*](https://www.coe.int/en/web/cepej/cepej-european-ethical-charter-on-the-use-of-artificial-intelligence-ai-in-judicial-systems-and-their-environment), 2018.
