"""LLM-based stance/sentiment analysis and comparison metrics."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, asdict
from itertools import chain
from typing import Dict, List

import requests

from .scraper import Article


@dataclass
class ArticleAnalysis:
    agency: str
    url: str
    title: str
    sentiment: str
    stance: str
    themes: List[str]
    confidence: float

    def to_dict(self) -> dict:
        return asdict(self)


class OllamaAnalyzer:
    def __init__(self, base_url: str, model: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model

    def analyze_articles(self, topic: str, articles: List[Article]) -> List[ArticleAnalysis]:
        results: List[ArticleAnalysis] = []
        for article in articles:
            prompt = (
                "Classify the article's sentiment and narrative stance regarding the target topic.\n"
                "Return strict JSON with keys: sentiment (positive/negative/neutral/mixed), "
                "stance (supportive/critical/balanced/unclear), themes (array of short strings), confidence (0-1).\n"
                f"Target topic: {topic}\n"
                f"Title: {article.title}\n"
                f"Content:\n{article.content[:5000]}"
            )
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
            }
            try:
                resp = requests.post(
                    f"{self.base_url}/api/generate", json=payload, timeout=90
                )
                resp.raise_for_status()
                parsed = json.loads(resp.json().get("response", "{}"))
            except Exception:
                parsed = {}

            results.append(
                ArticleAnalysis(
                    agency=article.agency,
                    url=article.url,
                    title=article.title,
                    sentiment=parsed.get("sentiment", "unknown"),
                    stance=parsed.get("stance", "unclear"),
                    themes=parsed.get("themes", []),
                    confidence=float(parsed.get("confidence", 0.0) or 0.0),
                )
            )
        return results


def compare_coverage(agency_a: str, agency_b: str, analyses: List[ArticleAnalysis]) -> Dict:
    a = [x for x in analyses if x.agency == agency_a]
    b = [x for x in analyses if x.agency == agency_b]

    themes_a = Counter(chain.from_iterable(x.themes for x in a))
    themes_b = Counter(chain.from_iterable(x.themes for x in b))
    overlap = sorted(set(themes_a) & set(themes_b))

    def counts(items: List[ArticleAnalysis], field: str) -> Dict[str, int]:
        c = Counter(getattr(x, field) for x in items)
        return dict(c)

    return {
        "agency_counts": {agency_a: len(a), agency_b: len(b)},
        "overlap_themes": overlap,
        "overlap_rate": (
            len(overlap) / max(1, len(set(themes_a) | set(themes_b)))
        ),
        "top_themes": {
            agency_a: themes_a.most_common(20),
            agency_b: themes_b.most_common(20),
        },
        "sentiment_distribution": {
            agency_a: counts(a, "sentiment"),
            agency_b: counts(b, "sentiment"),
        },
        "stance_distribution": {
            agency_a: counts(a, "stance"),
            agency_b: counts(b, "stance"),
        },
    }
