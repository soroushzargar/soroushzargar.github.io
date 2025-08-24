import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'

const root = process.cwd()
const pubsPath = path.join(root, 'content', 'publications')

export function getPublicationSlugs() {
  return fs.readdirSync(pubsPath).map((file) => file.replace(/\.mdx$/, ''))
}

export async function getPublicationBySlug(slug: string) {
  const filePath = path.join(pubsPath, `${slug}.mdx`)
  const source = fs.readFileSync(filePath, 'utf8')
  const { content, frontmatter } = await compileMDX({
    source,
    options: { parseFrontmatter: true, mdxOptions: { remarkPlugins: [remarkGfm] } },
  })
  return { content, meta: { ...(frontmatter as any), slug } }
}

export function getAllPublicationsMeta() {
  return getPublicationSlugs().map((slug) => {
    const filePath = path.join(pubsPath, `${slug}.mdx`)
    const file = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(file)
    return { ...(data as any), slug }
  })
}
