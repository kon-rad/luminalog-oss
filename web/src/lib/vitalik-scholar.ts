import { contentPosts } from '@/content/vitalik-scholar'

/* ──────────────────────────────────────────────────────────────────────────
 * Vitalik Scholar: study notes on Vitalik Buterin's talks and Ethereum.
 * Each entry is one talk: summaries, a blog body, short clips, chapter
 * timestamps and key terms with further reading. Rendered by
 * app/vitalik-scholar and components/vitalik-scholar.tsx.
 *
 * Entries are JSON in src/content/vitalik-scholar/, generated from the blog
 * markdown in the secondbrain vault (Areas/vitalik-scholar/) by the
 * vitalik-scholar skill. Edit the markdown and re-run the skill rather than
 * editing the JSON. Strings are plain text: real apostrophes and quotes,
 * no HTML entities, no em dashes; `[label](url)` inside a paragraph renders
 * as a link. Assets live in public/vitalik-scholar/<slug>/.
 * ────────────────────────────────────────────────────────────────────────── */

export type ScholarLink = { label: string; href: string }

export type ScholarBlock =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'pull'; text: string }
  | { type: 'figure'; src: string; alt: string; width: number; height: number; caption?: string }
  | { type: 'clip'; clip: number } // 1-based index into `clips`

export type ScholarClip = {
  title: string
  start: number // seconds into the original video
  end: number
  src: string // mp4 under /vitalik-scholar/<slug>/
  poster: string
  hook: string // one line on why the clip stands alone
}

export type ScholarTerm = {
  term: string
  kind: 'term' | 'topic' | 'idea'
  definition: string
  links: ScholarLink[]
}

export type ScholarPost = {
  slug: string
  title: string
  description: string // meta description + index excerpt
  date: string // publication date, human-readable
  isoDate: string // for sorting
  readingTime: string
  talk: {
    title: string
    speaker: string
    event: string
    date: string // when the talk was published
    youtubeId: string
    duration: string
  }
  hero: { src: string; alt: string; width: number; height: number }
  summary100: string
  summary1000: string[] // paragraphs
  body: ScholarBlock[]
  chapters: { start: number; title: string; note: string }[]
  clips: ScholarClip[]
  terms: ScholarTerm[]
  furtherReading: ScholarLink[]
}

export const scholarPosts: ScholarPost[] = contentPosts

export function getScholarPost(slug: string) {
  return scholarPosts.find((p) => p.slug === slug)
}

export function youtubeUrl(id: string, start?: number) {
  return `https://www.youtube.com/watch?v=${id}${start ? `&t=${Math.floor(start)}s` : ''}`
}

export function timestamp(sec: number) {
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}
