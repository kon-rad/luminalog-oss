import { ArrowUpRight, AudioLines, BookOpen, LockKeyhole } from 'lucide-react'
import { INK, SURFACE, CREAM, MUTE, ACCENT, HAIRLINE } from './theme'

const chapters = ['Life chapters', 'Bright memories', 'Harder moments', 'What comes next', 'Challenges', 'What you believe', 'The theme']

export default function VoiceFeaturesSection() {
  return (
    <section id="voice-and-life-story" aria-labelledby="voice-features-heading" style={{ background: INK, color: CREAM, padding: '88px 0 112px' }}>
      <div className="wrap">
        <div style={{ maxWidth: 700, marginBottom: 36 }}>
          <p style={{ color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Coming in the next iPhone update
          </p>
          <h2 id="voice-features-heading" className="serif" style={{ marginTop: 14, fontSize: 'clamp(32px, 5vw, 54px)', lineHeight: 1.1, fontWeight: 600 }}>
            Your voice.<br />Your life story.
          </h2>
          <p style={{ color: MUTE, fontSize: 17, lineHeight: 1.7, marginTop: 18 }}>
            Some days, you want to talk about what just happened. Other days, you want to
            make room for the story that brought you here. Two new ways to reflect with Argo.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))', gap: 24 }}>
          <article style={{ padding: 'clamp(24px, 4vw, 40px)', background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 24 }}>
            <AudioLines size={30} color={ACCENT} strokeWidth={1.5} aria-hidden="true" />
            <h3 className="serif" style={{ fontSize: 30, lineHeight: 1.2, marginTop: 24 }}>A conversation, closer to you.</h3>
            <p style={{ color: MUTE, fontSize: 16, lineHeight: 1.7, marginTop: 16 }}>
              Argo listens, transcribes and speaks on your iPhone. Your call audio stays on
              the phone, and you can interrupt the companion when a new thought comes.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, color: CREAM, fontSize: 13 }}>
              <LockKeyhole size={16} color={ACCENT} aria-hidden="true" />
              On-device speech. Encrypted transcripts.
            </div>
            <p style={{ color: MUTE, fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>
              The AI still needs an internet connection. Your words and selected journal
              context go as text to our server and AI provider to produce a reply.
              Speech models download on your first call.
            </p>
          </article>

          <article style={{ padding: 'clamp(24px, 4vw, 40px)', background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 24 }}>
            <BookOpen size={30} color={ACCENT} strokeWidth={1.5} aria-hidden="true" />
            <h3 className="serif" style={{ fontSize: 30, lineHeight: 1.2, marginTop: 24 }}>Tell it in your own words.</h3>
            <p style={{ color: MUTE, fontSize: 16, lineHeight: 1.7, marginTop: 16 }}>
              The Life Story Interview guides you through seven parts, from life chapters
              to what you believe. Take a part at a time, skip any question, and return
              to where you left off. Keep the transcript of each sitting.
            </p>
            <ol aria-label="The seven interview parts" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 0, listStyle: 'none', marginTop: 24 }}>
              {chapters.map((chapter, index) => (
                <li key={chapter} style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: MUTE }}>
                  <span style={{ color: ACCENT, marginRight: 6 }}>{index + 1}</span>{chapter}
                </li>
              ))}
            </ol>
            <p style={{ color: MUTE, fontSize: 13, lineHeight: 1.7, marginTop: 20 }}>
              The interviewer asks and listens without drawing on your journal. Your
              spoken answers go to the AI as text. This is a reflective interview, not therapy.
            </p>
          </article>
        </div>

        <a href="/articles/consumer-ai" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: ACCENT, fontSize: 15, fontWeight: 600, marginTop: 28 }}>
          Explore Consumer AI <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
