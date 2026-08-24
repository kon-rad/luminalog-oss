/* The canonical Argo social row, shared by every public footer.
 * One source of truth for the handles: edit here and every footer follows. */

type Social = {
  label: string
  href: string
  /* Screen-reader / tooltip text, since several icons repeat (two X, two YouTube). */
  title: string
  icon: 'x' | 'instagram' | 'youtube' | 'spotify' | 'github'
}

export const SOCIALS: Social[] = [
  { label: 'X', href: 'https://x.com/myargoquest', title: 'Argo on X', icon: 'x' },
  { label: 'Instagram', href: 'https://instagram.com/myargoquest', title: 'Argo on Instagram', icon: 'instagram' },
  { label: 'YouTube', href: 'https://www.youtube.com/@myargoquest', title: 'Argo on YouTube', icon: 'youtube' },
  { label: 'Podcast on YouTube', href: 'https://www.youtube.com/@ArgoPodcast', title: 'The Argo Podcast on YouTube', icon: 'youtube' },
  { label: 'Podcast on Spotify', href: 'https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2', title: 'The Argo Podcast on Spotify', icon: 'spotify' },
  { label: 'GitHub', href: 'https://github.com/kon-rad/luminalog-oss', title: 'Argo on GitHub (open source)', icon: 'github' },
  { label: 'Konrad Gnat', href: 'https://x.com/konrad_gnat', title: 'Konrad Gnat, founder, on X', icon: 'x' },
]

const PATHS: Record<Social['icon'], string> = {
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  instagram:
    'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38C1.35 2.68.93 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.72 2.13-1.38.66-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.93 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84M12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z',
  youtube:
    'M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81zM9.55 15.57V8.43L15.82 12z',
  spotify:
    'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.5-.59 11.66 1.34.35.22.46.68.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 0 1-.55-1.8c4.36-1.32 9.78-.68 13.49 1.6.44.27.58.85.32 1.29zm.13-3.4C15.23 8.33 8.9 8.12 5.2 9.25a1.12 1.12 0 1 1-.65-2.15c4.25-1.29 11.24-1.04 15.67 1.59a1.12 1.12 0 1 1-1.15 1.93z',
  github:
    'M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z',
}

/* A wrapping row of icon + label chips. Drop it into any footer. */
export default function SocialLinks({ marginTop = 28 }: { marginTop?: number }) {
  return (
    <div style={{ marginTop, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {SOCIALS.map(s => (
        <a
          key={s.href}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          title={s.title}
          aria-label={s.title}
          className="social-chip"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 13px',
            borderRadius: 100,
            border: '1px solid var(--hairline2)',
            background: 'var(--surface)',
            color: 'var(--text2)',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
            <path d={PATHS[s.icon]} />
          </svg>
          {s.label}
        </a>
      ))}
    </div>
  )
}
