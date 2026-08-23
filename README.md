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

## Local preview

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The pages `fetch()` the JSON data files, so
opening the HTML from `file://` will not work.
