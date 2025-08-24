import Link from 'next/link'
import { getAllPublicationsMeta } from '@/lib/mdx'

export default async function Home() {
  const publications = getAllPublicationsMeta()
  return (
    <div className="space-y-16">
      <section className="flex flex-col items-center text-center mt-10" id="hero">
        <img src="/profile.jpg" alt="Profile" className="w-32 h-32 rounded-full mb-4" />
        <h1 className="text-4xl font-bold">Your Name</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">Title · Affiliation</p>
        <p className="mt-4 max-w-xl">Short tagline about research interests.</p>
      </section>

      <section id="about">
        <h2 className="text-2xl font-semibold mb-4">About</h2>
        <p className="prose dark:prose-invert">
          A concise academic bio written in markdown. Replace this with your own biography.
        </p>
      </section>

      <section id="publications">
        <h2 className="text-2xl font-semibold mb-4">Selected Publications</h2>
        <ul className="space-y-4">
          {publications.map((pub) => (
            <li key={pub.slug} className="border-b pb-4">
              <h3 className="font-medium">
                <Link href={`/publications/${pub.slug}`} className="text-accent-dark hover:underline">
                  {pub.title} ({pub.year})
                </Link>
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{pub.venue}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="projects">
        <h2 className="text-2xl font-semibold mb-4">Projects</h2>
        <p>Project showcases coming soon.</p>
      </section>

      <section id="teaching">
        <h2 className="text-2xl font-semibold mb-4">Teaching & Talks</h2>
        <p>Teaching materials and talks will be listed here.</p>
      </section>

      <section id="blog">
        <h2 className="text-2xl font-semibold mb-4">Blog</h2>
        <p>Blog posts coming soon.</p>
      </section>

      <section id="contact">
        <h2 className="text-2xl font-semibold mb-4">Contact</h2>
        <ul>
          <li>Email: <a href="mailto:you@example.com" className="text-accent-dark">you@example.com</a></li>
          <li><a href="https://github.com/username" className="text-accent-dark">GitHub</a></li>
          <li><a href="https://linkedin.com/in/username" className="text-accent-dark">LinkedIn</a></li>
        </ul>
      </section>
    </div>
  )
}
