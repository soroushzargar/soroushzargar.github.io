"""Adaptive article discovery and content extraction."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


@dataclass
class Article:
    agency: str
    url: str
    title: str
    published_at: Optional[str]
    text_mode: str  # full_text | abstract | title_only
    content: str

    def to_dict(self) -> dict:
        return asdict(self)


class AdaptiveScraper:
    USER_AGENT = "Mozilla/5.0 (NewsComparatorBot/1.0)"

    def __init__(self, max_articles: int = 100) -> None:
        self.max_articles = max_articles

    def scrape(self, agency_name: str, homepage_url: str, candidate_urls: List[str]) -> List[Article]:
        urls = [u for u in candidate_urls if u]
        if homepage_url:
            urls.append(homepage_url)

        article_urls: List[str] = []
        for source in urls:
            article_urls.extend(self._discover_article_links(source, homepage_url))
            if len(article_urls) >= self.max_articles:
                break

        deduped = list(dict.fromkeys(article_urls))[: self.max_articles]
        articles: List[Article] = []
        for url in deduped:
            article = self._extract_article(agency_name, url)
            if article:
                articles.append(article)
        return articles

    def _request(self, url: str) -> Optional[requests.Response]:
        try:
            resp = requests.get(url, headers={"User-Agent": self.USER_AGENT}, timeout=25)
            if resp.ok:
                return resp
        except requests.RequestException:
            return None
        return None

    def _discover_article_links(self, source_url: str, homepage_url: str) -> List[str]:
        resp = self._request(source_url)
        if not resp:
            return []

        content_type = resp.headers.get("content-type", "")
        text = resp.text
        links: List[str] = []

        if "xml" in content_type or source_url.endswith((".xml", "/rss", "rss")):
            links.extend(self._parse_rss_links(text))
        else:
            soup = BeautifulSoup(text, "html.parser")
            for a in soup.select("a[href]"):
                href = a.get("href", "").strip()
                if href.startswith("#") or href.startswith("javascript:"):
                    continue
                full = urljoin(source_url or homepage_url, href)
                if self._looks_like_article_url(full):
                    links.append(full)

        return links

    def _parse_rss_links(self, xml_text: str) -> List[str]:
        links: List[str] = []
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return links
        for item in root.findall(".//item") + root.findall(".//entry"):
            link_elem = item.find("link")
            if link_elem is not None:
                href = link_elem.get("href") or (link_elem.text or "")
                if href:
                    links.append(href.strip())
        return links

    def _extract_article(self, agency: str, url: str) -> Optional[Article]:
        resp = self._request(url)
        if not resp:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")

        title = self._extract_title(soup) or url
        published_at = self._extract_published_date(soup, resp.headers.get("date", ""))

        full_text = self._extract_full_text(soup)
        if full_text:
            return Article(agency, url, title, published_at, "full_text", full_text)

        abstract = self._extract_abstract(soup, title)
        if abstract:
            return Article(agency, url, title, published_at, "abstract", abstract)

        return Article(agency, url, title, published_at, "title_only", title)

    def _extract_title(self, soup: BeautifulSoup) -> str:
        if soup.title and soup.title.string:
            return soup.title.string.strip()
        h1 = soup.find("h1")
        return h1.get_text(" ", strip=True) if h1 else ""

    def _extract_published_date(self, soup: BeautifulSoup, header_date: str) -> Optional[str]:
        for attr in [
            ("meta", {"property": "article:published_time"}, "content"),
            ("meta", {"name": "pubdate"}, "content"),
            ("time", {}, "datetime"),
        ]:
            tag = soup.find(attr[0], attrs=attr[1])
            if tag and tag.get(attr[2]):
                return tag.get(attr[2])
        if header_date:
            try:
                return parsedate_to_datetime(header_date).isoformat()
            except Exception:
                return None
        return None

    def _extract_full_text(self, soup: BeautifulSoup) -> str:
        article = soup.find("article")
        if article:
            text = article.get_text("\n", strip=True)
            if len(text.split()) > 120:
                return text

        paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        combined = "\n".join([p for p in paragraphs if len(p.split()) > 6])
        return combined if len(combined.split()) > 180 else ""

    def _extract_abstract(self, soup: BeautifulSoup, title: str) -> str:
        meta = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", attrs={"property": "og:description"}
        )
        desc = meta.get("content", "").strip() if meta else ""

        lines = []
        for p in soup.find_all("p")[:3]:
            txt = p.get_text(" ", strip=True)
            if txt:
                lines.append(txt)

        joined = "\n".join(lines)
        abstract = "\n".join([title, desc, joined]).strip()
        return abstract if len(abstract) > len(title) else ""

    def _looks_like_article_url(self, url: str) -> bool:
        lowered = url.lower()
        if any(x in lowered for x in ["/video", "/live", "/tag/", "/topic/"]):
            return False
        pattern = r"\d{4}/\d{2}/\d{2}|/news/|/article|/story"
        return bool(re.search(pattern, lowered))
