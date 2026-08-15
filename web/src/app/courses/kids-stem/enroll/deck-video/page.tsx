import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Presentation } from 'lucide-react'
import { CourseLayout, SectionHeading } from '@/components/course'
import { ENROLL_URL } from '@/lib/kids-stem/enroll'
import { DECK_URL, CLASS_VIDEO_SRC } from '@/lib/kids-stem/deck'

export const metadata: Metadata = {
  title: 'The class on video, Core Skills · Argo',
  description:
    'Watch a Kids Wholistic Creativity & STEM class in Forest City from start to finish: breathwork, drawing, journaling, a STEM concept, and the children teaching it back.',
}

export default function DeckVideoPage() {
  return (
    <CourseLayout>
      <section>
        <div className="wrap" style={{ padding: '48px 0 72px', maxWidth: 980 }}>
          <Link
            href={ENROLL_URL}
            className="inline-flex items-center gap-2"
            style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 18 }}
          >
            <ArrowLeft style={{ width: 15, height: 15 }} /> Back to enrolment
          </Link>

          <SectionHeading>The class on video</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: 'var(--text2)',
              margin: '14px 0 28px',
              maxWidth: 700,
            }}
          >
            A class in Forest City from start to finish, so you can see exactly how the hour runs
            before you decide.
          </p>

          <video
            controls
            preload="metadata"
            playsInline
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              display: 'block',
              background: '#000',
              borderRadius: 'var(--r-card)',
              border: '1px solid var(--hairline)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <source src={CLASS_VIDEO_SRC} type="video/mp4" />
            Your browser cannot play this video.
          </video>

          <div className="flex flex-wrap items-center" style={{ gap: 12, marginTop: 28 }}>
            <Link href={DECK_URL} className="btn-ghost">
              <Presentation style={{ width: 16, height: 16 }} />
              View the slide deck
            </Link>
            <Link href={ENROLL_URL} className="btn-amber">
              Back to enrolment
            </Link>
          </div>
        </div>
      </section>
    </CourseLayout>
  )
}
