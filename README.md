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
