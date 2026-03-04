from __future__ import annotations

import argparse
import json
from pathlib import Path

from .analysis import compare_coverage, OllamaAnalyzer
from .config import DEFAULT_CONFIG
from .llm_discovery import OllamaDiscoveryClient
from .scraper import AdaptiveScraper
from .visualization import build_visual_payload, write_visualization_html


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare two agencies' topic coverage.")
    parser.add_argument("agency_a", help="First agency name (e.g., Reuters)")
    parser.add_argument("agency_b", help="Second agency name (e.g., Al Jazeera)")
    parser.add_argument("topic", help="Topic to compare (e.g., Iran)")
    parser.add_argument("--ollama-url", default=DEFAULT_CONFIG.ollama_base_url)
    parser.add_argument("--discovery-model", default=DEFAULT_CONFIG.discovery_model)
    parser.add_argument("--analysis-model", default=DEFAULT_CONFIG.analysis_model)
    parser.add_argument("--max-articles", type=int, default=DEFAULT_CONFIG.max_articles_per_agency)
    parser.add_argument("--output-dir", default=str(DEFAULT_CONFIG.output_dir))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    discover = OllamaDiscoveryClient(args.ollama_url, args.discovery_model)
    scraper = AdaptiveScraper(args.max_articles)
    analyzer = OllamaAnalyzer(args.ollama_url, args.analysis_model)

    endpoint_a = discover.discover(args.agency_a)
    endpoint_b = discover.discover(args.agency_b)

    articles_a = scraper.scrape(
        endpoint_a.name, endpoint_a.homepage_url, endpoint_a.api_or_feed_urls
    )
    articles_b = scraper.scrape(
        endpoint_b.name, endpoint_b.homepage_url, endpoint_b.api_or_feed_urls
    )
    all_articles = articles_a + articles_b

    analyses = analyzer.analyze_articles(args.topic, all_articles)
    comparison = compare_coverage(endpoint_a.name, endpoint_b.name, analyses)
    visual_payload = build_visual_payload(all_articles, analyses)

    (output_dir / "discovered_endpoints.json").write_text(
        json.dumps(
            {
                endpoint_a.name: {
                    "homepage": endpoint_a.homepage_url,
                    "feeds": endpoint_a.api_or_feed_urls,
                },
                endpoint_b.name: {
                    "homepage": endpoint_b.homepage_url,
                    "feeds": endpoint_b.api_or_feed_urls,
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    (output_dir / "articles.json").write_text(
        json.dumps([a.to_dict() for a in all_articles], indent=2), encoding="utf-8"
    )
    (output_dir / "analyses.json").write_text(
        json.dumps([a.to_dict() for a in analyses], indent=2), encoding="utf-8"
    )
    (output_dir / "comparison_stats.json").write_text(
        json.dumps(comparison, indent=2), encoding="utf-8"
    )
    write_visualization_html(args.topic, visual_payload, output_dir / "comparison_dashboard.html")

    print(f"Saved outputs in {output_dir.resolve()}")


if __name__ == "__main__":
    main()
