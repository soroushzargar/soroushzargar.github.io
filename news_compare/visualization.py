"""Generate D3.js visualizations (timeline + thematic word cloud)."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from .analysis import ArticleAnalysis
from .scraper import Article


HTML_TEMPLATE = """<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>News Coverage Comparison</title>
  <script src=\"https://d3js.org/d3.v7.min.js\"></script>
  <script src=\"https://cdn.jsdelivr.net/npm/d3-cloud@1/build/d3.layout.cloud.js\"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .row { display: flex; gap: 24px; }
    .chart { border: 1px solid #ddd; padding: 8px; border-radius: 8px; }
    .tooltip { position: absolute; pointer-events: none; background: #fff; border:1px solid #333; padding:6px; }
  </style>
</head>
<body>
<h1>Coverage Comparison: __TOPIC__</h1>
<div id=\"timeline\" class=\"chart\"></div>
<div class=\"row\">
  <div id=\"wordcloudA\" class=\"chart\"></div>
  <div id=\"wordcloudB\" class=\"chart\"></div>
</div>
<script>
const payload = __DATA__;

const timelineDiv = d3.select('#timeline');
const width = 1000, height = 280;
const svg = timelineDiv.append('svg').attr('width', width).attr('height', height);
const points = payload.timeline.filter(d => d.date);
const parseDate = d3.utcParse('%Y-%m-%d');
points.forEach(d => d.dt = parseDate(d.date));

const x = d3.scaleTime().domain(d3.extent(points, d => d.dt)).range([50, width - 20]);
const y = d3.scalePoint().domain(payload.agencies).range([50, height - 30]);
svg.append('g').attr('transform', `translate(0,${height-30})`).call(d3.axisBottom(x));
svg.append('g').attr('transform', 'translate(50,0)').call(d3.axisLeft(y));
svg.selectAll('circle').data(points).enter().append('circle')
  .attr('cx', d => x(d.dt)).attr('cy', d => y(d.agency)).attr('r', 4)
  .attr('fill', d => d.stance === 'critical' ? '#d62728' : d.stance === 'supportive' ? '#2ca02c' : '#1f77b4')
  .append('title').text(d => `${d.title} (${d.sentiment}/${d.stance})`);

function drawCloud(nodeId, words, title) {
  d3.select(nodeId).append('h3').text(title);
  const w = 480, h = 360;
  const svg = d3.select(nodeId).append('svg').attr('width', w).attr('height', h)
      .append('g').attr('transform', `translate(${w/2},${h/2})`);
  d3.layout.cloud().size([w, h]).words(words.map(d => ({text: d.word, size: 12 + d.count*2})))
    .padding(3).rotate(() => (Math.random() > 0.8 ? 90 : 0))
    .font('sans-serif').fontSize(d => d.size)
    .on('end', draw).start();
  function draw(words) {
    svg.selectAll('text').data(words).enter().append('text')
      .style('font-size', d => d.size + 'px').style('fill', '#333')
      .attr('text-anchor', 'middle').attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
      .text(d => d.text);
  }
}

drawCloud('#wordcloudA', payload.wordcloud[payload.agencies[0]], payload.agencies[0] + ' themes');
drawCloud('#wordcloudB', payload.wordcloud[payload.agencies[1]], payload.agencies[1] + ' themes');
</script>
</body>
</html>
"""


def _short_date(iso: str | None) -> str | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return None


def build_visual_payload(articles: List[Article], analyses: List[ArticleAnalysis]) -> Dict:
    analysis_by_url = {a.url: a for a in analyses}
    timeline = []
    themes_by_agency: Dict[str, Counter] = {}
    agencies = sorted(set(a.agency for a in articles))

    for article in articles:
        a = analysis_by_url.get(article.url)
        if not a:
            continue
        timeline.append(
            {
                "agency": article.agency,
                "date": _short_date(article.published_at),
                "title": article.title,
                "sentiment": a.sentiment,
                "stance": a.stance,
            }
        )
        themes_by_agency.setdefault(article.agency, Counter()).update(a.themes)

    wordcloud = {
        agency: [{"word": w, "count": c} for w, c in counter.most_common(50)]
        for agency, counter in themes_by_agency.items()
    }
    for agency in agencies:
        wordcloud.setdefault(agency, [])

    return {"timeline": timeline, "wordcloud": wordcloud, "agencies": agencies}


def write_visualization_html(topic: str, payload: Dict, output_file: Path) -> None:
    html = HTML_TEMPLATE.replace("__TOPIC__", topic).replace(
        "__DATA__", json.dumps(payload)
    )
    output_file.write_text(html, encoding="utf-8")
