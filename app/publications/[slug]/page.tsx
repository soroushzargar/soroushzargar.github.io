import { getPublicationBySlug, getPublicationSlugs } from '@/lib/mdx'

export async function generateStaticParams() {
  return getPublicationSlugs().map((slug) => ({ slug }))
}

export default async function PublicationPage({ params }: { params: { slug: string } }) {
  const { content, meta } = await getPublicationBySlug(params.slug)
  return (
    <article className="prose dark:prose-invert mx-auto py-8">
      <h1>{meta.title}</h1>
      <p className="text-sm text-gray-500">{meta.authors} · {meta.venue} · {meta.year}</p>
      {content}
      <div className="mt-4 flex gap-4">
        {meta.pdf && <a href={meta.pdf} className="text-accent-dark">PDF</a>}
        {meta.code && <a href={meta.code} className="text-accent-dark">Code</a>}
        {meta.arxiv && <a href={meta.arxiv} className="text-accent-dark">arXiv</a>}
        {meta.bibtex && <a href={meta.bibtex} className="text-accent-dark">BibTeX</a>}
      </div>
    </article>
  )
}
