"""LLM-assisted website/API discovery for news agencies."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import List

import requests


@dataclass
class AgencyEndpoint:
    name: str
    homepage_url: str
    api_or_feed_urls: List[str]


class OllamaDiscoveryClient:
    def __init__(self, base_url: str, model: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model

    def discover(self, agency_name: str) -> AgencyEndpoint:
        prompt = (
            "Given only the agency name, identify the official news homepage URL and "
            "up to 5 likely API/feed/article-index endpoints (RSS, sitemap, JSON API).\n"
            "Return strict JSON with keys: name, homepage_url, api_or_feed_urls (array of strings).\n"
            f"Agency: {agency_name}"
        )
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }

        response = requests.post(
            f"{self.base_url}/api/generate", json=payload, timeout=60
        )
        response.raise_for_status()
        raw = response.json().get("response", "{}")
        data = json.loads(raw)

        return AgencyEndpoint(
            name=data.get("name", agency_name),
            homepage_url=data.get("homepage_url", "").strip(),
            api_or_feed_urls=[u.strip() for u in data.get("api_or_feed_urls", []) if u],
        )
