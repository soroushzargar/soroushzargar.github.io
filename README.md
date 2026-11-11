# soroushzargar.github.io

Personal academic site. Plain static HTML/CSS/JS — no build step, no dependencies.
Pushing to `master` deploys via GitHub Pages (`.github/workflows/deploy.yml`).

## Structure

```
index.html          Home
publications.html   Full publication list (year-grouped)
pub.html            Publication detail  →  pub.html?id=<pub id>
blog.html           Writing index
blog-post.html      Post renderer       →  blog-post.html?slug=<post slug>
cv.html             CV
404.html            Not-found page

assets/site.css     The whole design system
assets/site.js      Scroll reveals + rendering of the data files
assets/asd-plots/    Live canvas plots, embedded in a post with <canvas data-plot="name">
assets/lab/lab.js   Interactive toy models, embedded with <figure class="lab" data-lab="name">

data/publications.json   Source of truth for all publications
data/blogs.json          Source of truth for the post listings
blogs/<slug>.md          Post bodies (frontmatter + Markdown + LaTeX)
```

## Design

Quiet editorial/academic: Libre Caslon Text for display, Work Sans for text,
warm paper ground (`#faf8f4`), oxford-blue accent (`#2a3f5c`). All colours,
type, and rhythm live in the `:root` block of `assets/site.css`.

## Adding a publication

Append an object to `data/publications.json`:

```json
{
  "id": "short-slug-2026",
  "year": 2026,
  "title": "…",
  "authorsHtml": "<strong>Soroush H. Zargarbashi</strong>, …",
  "venue": "Full venue line, shown on the detail page",
  "venueTag": "ICLR 2026",
  "tags": ["ICLR 2026", "Conformal Prediction"],
  "links": { "paper": null, "poster": null, "talk": null },
  "selected": false,
  "postSlug": null,
  "abstract": "…"
}
```

- `selected: true` puts it on the home page and the CV.
- `postSlug` links it to a post in `blogs/` (adds a "Read the write-up" link).
- `links` entries that stay `null` render as inactive labels.
- `authorsHtml` and `venue` accept inline HTML (`<strong>`, `<em>`); everything
  else is escaped on render.

## Adding a post

1. Write `blogs/<slug>.md` with frontmatter:

   ```markdown
   ---
   title: Post title
   date: 2026-08-01
   dateDisplay: August 1, 2026
   tags: [Tag One, Tag Two]
   ---
   ```

   Markdown body, `$inline$` and `$$display$$` LaTeX both render (KaTeX).

2. Add the matching entry to `posts` in `data/blogs.json` (see `_template`
   there). `readingMinutes` is used in listings; the post page computes its own
   from the Markdown at 180 wpm — keep the two roughly in step.

## Interactive models

A publication page can carry one interactive model of the paper's idea, shown
above the abstract under "The idea, live". `assets/lab/lab.js` holds the models,
which run in the browser and respond to sliders and the pointer:

- `robust` — conformal prediction on a three-class toy problem under an attacker
  of radius ε: standard sets, robust sets at test time, robust calibration
- `graph` — conformal sets on a toy graph with neighbourhood diffusion of scores
- `evolution` — evolutionary search for the edge flips that hurt a toy graph
  classifier most, against random search with the same budget

Attach one to a paper with a `lab` object in `data/publications.json`:

```json
"lab": {
  "name": "graph",
  "title": "Short headline",
  "intro": "Two or three sentences on what to try.",
  "caption": "What the toy is, and that it is not an experiment from the paper."
}
```

Use `"plot": "river"` (plus `"alt"`) instead of `"name"` to show one of the canvas
plots from `assets/asd-plots/`. Papers with a `lab` get an "Interactive" marker in
the lists. To add a model, write a `function myLab(figure) { … }` in `lab.js` and
register it in `LABS`. A model can also go in a post's Markdown with
`<figure class="lab" data-lab="graph"><figcaption>…</figcaption></figure>`.

The publications page builds its topic filters from the `tags` in
`data/publications.json` (every tag after the first, if at least two papers share it).

## Search engines

`robots.txt` and `sitemap.xml` sit at the root. After adding a publication or a
post, rebuild the sitemap with `python3 tools/sitemap.py`. The home page carries
the structured data (`application/ld+json`) that tells search engines who the
site is about, including name variants; update it there if your position changes.

## Local preview

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The pages `fetch()` the JSON data files, so
opening the HTML from `file://` will not work.
