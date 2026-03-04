# Academic Website Skeleton

This repository contains a minimal Next.js 14 + Tailwind CSS setup for an academic website.

## Structure
- `app/` – Next.js App Router pages and layouts.
- `components/` – Reusable UI components.
- `content/` – MDX content for publications, projects, and posts.
- `lib/` – Utility functions for loading MDX.
- `public/` – Static assets such as images and PDFs.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Build and export the static site:
   ```bash
   npm run build
   ```

## Customization
Replace the placeholder content in `content/` and update sections in `app/page.tsx` with your own information. Add more publications or blog posts by creating new `.mdx` files.

## Deployment
The project is configured for static export (`next build && next export`), making it ready for deployment on [Vercel](https://vercel.com) or any static hosting service.

## News Coverage Comparator (Python)
A standalone Python toolkit was added under `news_compare/` to compare two agencies' coverage of a topic using your Ollama server.

### Features
- LLM-based discovery of each agency's official homepage/feed endpoints.
- Adaptive scraping for up to 100 recent articles per agency with fallback levels:
  1. full text
  2. abstract (title + opening lines/meta description)
  3. title only
- LLM classification per article (sentiment + narrative stance + themes).
- Comparison outputs: overlap, topic/theme trends, sentiment/stance distributions.
- Interactive D3.js dashboard (timeline + dual word clouds).

### Run
```bash
python -m news_compare.main "Reuters" "Al Jazeera" "Iran" \
  --ollama-url http://localhost:11434 \
  --discovery-model llama3.1 \
  --analysis-model llama3.1 \
  --max-articles 100
```

### Outputs
Generated in `news_compare/output/`:
- `discovered_endpoints.json`
- `articles.json`
- `analyses.json`
- `comparison_stats.json`
- `comparison_dashboard.html`
