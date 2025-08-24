'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <nav className="flex justify-between items-center py-4">
      <div className="text-xl font-semibold">Your Name</div>
      <div className="flex items-center gap-4">
        <Link href="#about">About</Link>
        <Link href="#publications">Publications</Link>
        <Link href="#projects">Projects</Link>
        <Link href="#teaching">Teaching</Link>
        <Link href="#blog">Blog</Link>
        <button aria-label="Toggle Dark Mode" onClick={toggleTheme} className="p-2 rounded">
          {mounted && theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  )
}
