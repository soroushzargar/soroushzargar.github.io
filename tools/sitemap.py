#!/usr/bin/env python3
"""Rebuild sitemap.xml from the data files. Run from the repo root after adding
a publication or a post:  python3 tools/sitemap.py"""
import json
from urllib.parse import quote

SITE = "https://soroushzargar.github.io/"

pubs = json.load(open("data/publications.json"))
posts = json.load(open("data/blogs.json"))["posts"]

urls = [(SITE, None), (SITE + "publications.html", None), (SITE + "blog.html", None), (SITE + "cv.html", None)]
urls += [(SITE + "blog-post.html?slug=" + quote(p["slug"]), p.get("date")) for p in posts]
urls += [(SITE + "pub.html?id=" + quote(p["id"]), None) for p in pubs]

lines = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, date in urls:
    lastmod = "<lastmod>%s</lastmod>" % date if date else ""
    lines.append("  <url><loc>%s</loc>%s</url>" % (loc, lastmod))
lines.append("</urlset>")
open("sitemap.xml", "w").write("\n".join(lines) + "\n")
print("sitemap.xml: %d URLs" % len(urls))
