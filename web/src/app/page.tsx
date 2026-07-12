'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import WaitlistForm from '@/components/WaitlistForm'

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible')
          observer.unobserve(e.target)
        }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Navbar />
      <span id="top" />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 70% at 75% -5%, rgba(206,127,68,0.15), transparent 55%)',
        }} />
        <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 48, alignItems: 'center', padding: '88px 0 80px' }} className="hero-grid">
            <div>
              <span className="eyebrow">Your AI journaling companion</span>
              <h1 className="serif" style={{ marginTop: 16, fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1.04, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                Merge with AI<br />through daily<br />conversation.
              </h1>
              <p style={{ marginTop: 22, fontSize: 19, lineHeight: 1.65, color: 'var(--text2)', maxWidth: 500 }}>
                LuminaLog is your AI journaling companion — and the first of a new category we call <b style={{ color: 'var(--text)', fontWeight: 600 }}>The Merge</b>: a daily practice of merging with an AI built entirely from your own life. Capture your days in text, voice, video, or photos, talk to an AI that has read every entry you&apos;ve ever written, and grow more articulate and whole as it comes to know you.
              </p>
              <div id="waitlist" style={{ marginTop: 34 }}>
                <WaitlistForm source="hero" />
                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: 'var(--text3)' }}>Not yet on the App Store — join the waitlist for early access.</span>
                  <a href="#how" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 15, fontWeight: 600 }}>
                    See how it works
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                  </a>
                </div>
              </div>
              <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>🔒 End-to-end encrypted</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>📱 On-device dictation</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>🎯 You choose what the AI sees</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>🚫 Never trained on your data</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>⭐ Open source</span>
              </div>
            </div>

            {/* Phone mockup */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(206,127,68,0.18), transparent 65%)', filter: 'blur(8px)', zIndex: 0 }} />
              <div style={{ transform: 'rotate(4deg)', position: 'relative', zIndex: 1 }}>
                <div className="phone">
                  <div className="phone-island" />
                  <div className="phone-bar" />
                  <div style={{ paddingTop: 52 }}>
                    <div style={{ padding: '8px 16px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5zM12 6.5v13"/></svg>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>LuminaLog</span>
                      </div>
                      <div className="serif" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', lineHeight: 1.15, marginTop: 8 }}>Good morning,<br />Alex</div>
                    </div>
                    {/* Prompt card */}
                    <div style={{ margin: '14px 16px 0', padding: '18px 18px 16px', borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(155deg, var(--accent), var(--accentDeep))', color: '#fff', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', filter: 'blur(8px)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.9, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10, position: 'relative' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                        Today&apos;s prompt
                      </div>
                      <div className="serif" style={{ fontSize: 17, lineHeight: 1.35, fontWeight: 500, position: 'relative' }}>&ldquo;What were you really afraid of last Thursday — and have you felt that before?&rdquo;</div>
                      <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', color: 'var(--accentDeep)', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, position: 'relative' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>
                        Start journaling
                      </div>
                    </div>
                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 10, margin: '10px 16px 0' }}>
                      {[['🔥', '14 days', 'Current streak'], ['✍️', '9,241', 'Words written']].map(([icon, val, lbl]) => (
                        <div key={lbl} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 16, padding: '12px 14px', boxShadow: '0 1px 2px rgba(70,50,30,0.04), 0 4px 12px rgba(70,50,30,0.05)' }}>
                          <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{val}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    {/* Entries */}
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)', margin: '14px 16px 8px' }}>Recent entries</div>
                    {[
                      { init: 'T', text: '"I keep second-guessing the decision, even though I know it was right at the time..."', meta: '📝 Text · 2h ago', bg: 'var(--accentSoft)' },
                      { init: '🎤', text: '"Talked about the meeting with Sarah. Something felt off and I didn\'t say it..."', meta: '🎤 Voice · Yesterday', bg: '#F5E7D5' },
                    ].map(({ init, text, meta, bg }) => (
                      <div key={meta} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--hairline)' }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}>{init}</div>
                        <div>
                          <div className="serif" style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text)' }}>{text}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }}>{meta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE PROMISE ── */}
      <section className="fade-up" style={{ padding: '104px 0', background: 'var(--surfaceAlt)' }}>
        <div className="wrap">
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <span className="eyebrow">The one thing that changes everything</span>
            <h2 className="serif" style={{ marginTop: 16, fontSize: 'clamp(32px,4vw,50px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              You cannot see your own patterns. We can.
            </h2>
            <p style={{ marginTop: 24, fontSize: 18, color: 'var(--text2)', lineHeight: 1.75 }}>
              Most people move through life without ever truly seeing themselves. They repeat the same fears. Ask the wrong questions. Miss the connections between where they are and where they&apos;ve been. Not because they&apos;re not thoughtful — but because no one can see themselves clearly from inside their own head.
            </p>
            <p style={{ marginTop: 16, fontSize: 18, color: 'var(--text2)', lineHeight: 1.75 }}>
              LuminaLog gives you the outside view. Every entry you write, speak, or film is indexed and remembered. The AI reads across everything — your words, your voice, your face, your history — and shows you what it sees.
            </p>
            <div style={{ margin: '40px auto', maxWidth: 560, textAlign: 'left', borderLeft: '3px solid var(--accent)', paddingLeft: 24 }}>
              <p className="serif" style={{ fontStyle: 'italic', fontSize: 20, lineHeight: 1.55, color: 'var(--text2)' }}>
                &ldquo;It&apos;s the first time I&apos;ve ever had a conversation about my journal that didn&apos;t start with me explaining who I am — and the first time something showed me a pattern I was completely blind to.&rdquo;
              </p>
            </div>
          </div>
          {/* Chat mockup */}
          <div style={{ maxWidth: 520, margin: '52px auto 0' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 24, padding: 24, boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accentDeep))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>✦</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>LuminaLog AI</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Your personal companion</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="bubble-ai">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 6 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                    Lumina
                  </div>
                  <div className="serif" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' }}>&ldquo;You&apos;ve mentioned fear of being misunderstood in seven entries over the past four months — always right before a creative project. You never named it that way. Does that resonate?&rdquo;</div>
                </div>
                <div className="bubble-user">I didn&apos;t realize I was doing that.</div>
                <div className="bubble-ai">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 6 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                    Lumina
                  </div>
                  <div className="serif" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' }}>&ldquo;Most people don&apos;t. The pattern usually shows up as procrastination or self-editing. What would change if you knew this was the root?&rdquo;</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU UNLOCK ── */}
      <section className="fade-up" style={{ padding: '104px 0', background: 'var(--bg)' }}>
        <div className="wrap">
          <div style={{ marginBottom: 52 }}>
            <h2 className="serif" style={{ fontSize: 'clamp(30px,3.8vw,44px)', fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.025em' }}>What you unlock.</h2>
            <p style={{ marginTop: 16, fontSize: 18, color: 'var(--text2)', lineHeight: 1.65 }}>Six capabilities you did not have before.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="unlock-grid">
            {[
              ['Grow in any direction', 'Set any goal that matters to you. The AI links your entries to it and tracks your progress across time.'],
              ['See things differently', 'The AI reads across months of entries and returns a view of you that you could never construct from inside your own head. Your perspective expands.'],
              ['Ask the right questions', "LuminaLog doesn't give you answers — it gives you the questions you weren't asking. The ones drawn from your actual history that unlock the next level of clarity."],
              ['Spot invisible patterns', 'Recurring fears, creative blocks, emotional cycles, belief contradictions. The AI finds what repeats and shows it to you plainly, without judgment.'],
              ['Connect past to present', 'A goal from last month linked to an insight from six months ago. A current fear traced back to something you wrote and forgot. The dots you never connected — connected.'],
              ['Get holistic feedback from video', "When you record a video entry, the AI analyses your face, tone of voice, and energy — not just your words. It notices what you didn't say."],
            ].map(([title, desc]) => (
              <div key={title as string} className="card" style={{ padding: 24 }}>
                <div style={{ color: 'var(--accent)', fontSize: 18, marginBottom: 14 }}>✦</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.58 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAPTURE ── */}
      <section className="fade-up" style={{ padding: '104px 0', background: 'var(--surfaceAlt)' }}>
        <div className="wrap">
          <div style={{ marginBottom: 52 }}>
            <span className="eyebrow">Four formats, one memory</span>
            <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px,3.8vw,44px)', fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.025em' }}>Journal the way you think.</h2>
            <p style={{ marginTop: 16, fontSize: 18, color: 'var(--text2)', lineHeight: 1.65 }}>Write it. Say it. Film it. Or photograph the page.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="capture-grid">
            {[
              { pill: 'Text', pillBg: 'rgba(206,127,68,0.12)', pillColor: 'var(--accentDeep)', title: 'Write what\'s on your mind.', desc: 'A clean, distraction-free editor. No formatting toolbars, no pressure. Just you and the page — and an AI that will remember every word.' },
              { pill: 'Voice', pillBg: 'rgba(193,108,108,0.12)', pillColor: '#C16C6C', title: 'Speak your thoughts.', desc: 'Record as you go — LuminaLog transcribes in real time, on your device. Your voice stays private, and your tone is analysed for patterns you didn\'t notice. The more you speak, the sharper your language — and your ability to put your inner life into words.' },
              { pill: 'Video', pillBg: 'rgba(137,123,168,0.12)', pillColor: '#7B6FA0', title: 'Film yourself.', desc: 'Record a moment, a reflection, a conversation with yourself. The AI reads your words — and watches your face and hears your voice for what\'s beneath them.' },
              { pill: 'Image', pillBg: 'rgba(110,140,119,0.12)', pillColor: '#4E7A5A', title: 'Photograph your notebook.', desc: 'Already journaling on paper? Snap the page. We read your handwriting, make it searchable, and add it to your AI\'s memory.' },
            ].map(({ pill, pillBg, pillColor, title, desc }) => (
              <div key={pill} className="card" style={{ padding: 28 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 16, background: pillBg, color: pillColor }}>{pill}</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIDEO INTELLIGENCE (DARK) ── */}
      <section className="fade-up" style={{ padding: '104px 0', background: 'var(--dark-bg)' }}>
        <div className="wrap">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }} className="video-split">
            <div>
              <span className="eyebrow">Video Intelligence</span>
              <h2 className="serif" style={{ marginTop: 12, fontSize: 'clamp(30px,3.6vw,42px)', fontWeight: 600, color: 'var(--dark-text)', letterSpacing: '-0.025em' }}>It sees what<br />you don&apos;t say.</h2>
              <p style={{ fontSize: 17, lineHeight: 1.72, color: 'var(--dark-text2)', marginTop: 20 }}>When you record a video entry, LuminaLog doesn&apos;t just transcribe your words. The AI analyses your facial expressions, your tone of voice, your energy, and your body language — then offers feedback that goes far beyond what you said out loud.</p>
              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  '"Your voice tightened noticeably when you mentioned the project deadline."',
                  '"You smiled three times talking about Thursday — you didn\'t mention it as a good day."',
                  '"This is the fourth entry where your energy dropped when you brought up that relationship."',
                ].map((chip) => (
                  <div key={chip} style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-hairline)', borderRadius: 14, padding: '13px 16px', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--dark-text)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>✦</span>
                    {chip}
                  </div>
                ))}
              </div>
            </div>
            {/* Dark phone */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(206,127,68,0.18),transparent 65%)', filter: 'blur(16px)' }} />
              <div className="phone dark" style={{ position: 'relative', zIndex: 1 }}>
                <div className="phone-island" />
                <div className="phone-bar" />
                <div style={{ paddingTop: 48 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 0', color: 'var(--dark-text2)', fontSize: 13 }}>
                    <span style={{ color: 'var(--accent)' }}>‹ Journal</span>
                    <span style={{ fontWeight: 600, color: 'var(--dark-text)', fontSize: 15 }}>Wednesday</span>
                    <span>···</span>
                  </div>
                  <div style={{ margin: '10px 16px 0', borderRadius: 18, overflow: 'hidden', height: 160, background: '#000', position: 'relative' }}>
                    <div style={{ width: '100%', height: '100%', background: 'radial-gradient(ellipse 60% 70% at 50% 40%, #3A3028, #0C0A06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(206,127,68,0.4)' }} />
                        <div style={{ width: 64, height: 28, borderRadius: 8, background: 'rgba(206,127,68,0.2)' }} />
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>2:34</div>
                  </div>
                  <div style={{ padding: '10px 16px 0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--dark-text2)', marginBottom: 6 }}>Transcript</div>
                    <div className="serif" style={{ fontSize: 12, color: 'var(--dark-text2)', lineHeight: 1.55, fontStyle: 'italic' }}>&ldquo;I keep telling myself it doesn&apos;t matter, but every time the deadline comes up I feel this tightening in my chest and I...&rdquo;</div>
                  </div>
                  <div style={{ padding: '8px 16px 0' }}>
                    <div style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-hairline)', borderRadius: 16, padding: '12px 14px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 7 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                        Video insights
                      </div>
                      <div className="serif" style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--dark-text2)', fontStyle: 'italic' }}>&ldquo;Your voice tightened noticeably when you mentioned the project deadline — a pattern I&apos;ve seen in three prior entries.&rdquo;</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── REFLECT ── */}
      <section className="fade-up" id="reflect" style={{ padding: '104px 0', background: 'var(--bg)' }}>
        <div className="wrap">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="feat-split">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="phone" style={{ width: 260, height: 564 }}>
                <div className="phone-island" />
                <div className="phone-bar" />
                <div style={{ paddingTop: 48 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 0' }}>
                    <span style={{ color: 'var(--accent)', fontSize: 13 }}>‹</span>
                    <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Insights</div>
                    <div style={{ width: 20 }} />
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 18, padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(70,50,30,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 8 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                        AI analysis
                      </div>
                      {['"A recurring pattern of self-doubt before creative projects — this is the sixth entry where it surfaces."', '"An undertone of gratitude you don\'t name directly."', '"The fear you described here connects closely to what you wrote in March."'].map((text, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '6px 0', borderBottom: i < 2 ? '1px solid var(--hairline)' : 'none' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                          <div className="serif" style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text2)', fontStyle: 'italic' }}>{text}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ width: '100%', padding: '11px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 13, fontSize: 13, fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                      Generate 5 prompts →
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 18, padding: 14, marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Themes this week</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[['Uncertainty', 'var(--accentSoft)', 'var(--accentDeep)'], ['Creative block', 'var(--accentSoft)', 'var(--accentDeep)'], ['Growth', 'rgba(74,127,212,0.1)', '#4A7FD4']].map(([label, bg, color]) => (
                          <span key={label as string} style={{ background: bg as string, color: color as string, padding: '4px 10px', borderRadius: 100, fontSize: 10.5, fontWeight: 600 }}>{label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="eyebrow">AI Analysis</span>
              <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px,3.6vw,42px)', fontWeight: 600, letterSpacing: '-0.025em' }}>Your life,<br />reflected back.</h2>
              <p style={{ marginTop: 18, fontSize: 17, color: 'var(--text2)', lineHeight: 1.7 }}>Every entry receives an AI-generated summary and a set of insights — not just from what you wrote today, but from everything the AI knows about you. It finds the themes threading through your last six months, the emotional patterns you couldn&apos;t name, and the connections between your current goals and things you recorded and forgot.</p>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  ['Daily prompt', 'One personalized question each morning, drawn from your recent themes and where you are in your growth.'],
                  ['Cross-entry patterns', 'The AI reads across your entire journal, not just today\'s entry — finding threads that span months or years.'],
                ].map(([title, desc]) => (
                  <div key={title as string} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                    </span>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h4>
                      <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5, marginTop: 4 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DAILY PRACTICE: 750-WORD STREAK + INSIGHTS CARD ── */}
      <section className="fade-up" id="practice" style={{ padding: '104px 0', background: 'var(--surfaceAlt)' }}>
        <div className="wrap">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="feat-split">
            <div>
              <span className="eyebrow">The daily practice · 750 words</span>
              <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px,3.6vw,42px)', fontWeight: 600, letterSpacing: '-0.025em' }}>A streak that gives you<br />something back.</h2>
              <p style={{ marginTop: 18, fontSize: 17, color: 'var(--text2)', lineHeight: 1.7 }}>Three pages a day — about 750 words. Write them, speak them on a walk, or film them before bed; LuminaLog transcribes it all and counts every word toward your day. Cross 750 and the day is yours: your streak grows, and it stays grown. Miss a day and the journal simply waits — no guilt, no pressure. The more days you give it, the more your companion comes to understand you.</p>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  ['Three pages, any format', 'Text, voice, or video — it all transcribes and adds up toward your daily 750.'],
                  ['Cross 750, get your card', 'Hit the goal and LuminaLog reads the day back to you as a beautiful, shareable Daily Insights card.'],
                  ['Your streak grows — and stays grown', 'Days you earn are never taken back. A gap is simply a fresh start, never a loss.'],
                ].map(([title, desc]) => (
                  <div key={title as string} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5z"/></svg>
                    </span>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h4>
                      <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5, marginTop: 4 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.55 }}>You choose what to share. Mark any entry private and it stays out — of the card and the insights.</p>
            </div>
            {/* Daily Insights card mock */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
                <div style={{ position: 'absolute', inset: -22, borderRadius: 38, background: 'radial-gradient(circle, rgba(206,127,68,0.24), transparent 70%)', filter: 'blur(10px)', zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', aspectRatio: '320 / 580', borderRadius: 26, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.30)', background: 'linear-gradient(160deg, #4A3826, #18110A)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 55% at 72% 12%, rgba(232,160,90,0.5), transparent 60%)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.22), rgba(0,0,0,0.80))' }} />
                  <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', padding: '22px 20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#F0C18A' }}>Daily Insights</div>
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
                      {[
                        ['Insights', 'You wrote about the meeting with more calm than the version of you from March would have.'],
                        ['A new perspective', 'The hesitation you keep noting may be care, not doubt — you slow down for what matters.'],
                        ['Reflect on', 'What would change if you trusted that instinct a little sooner?'],
                      ].map(([label, text]) => (
                        <div key={label}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>{label}</div>
                          <div className="serif" style={{ fontSize: 13, lineHeight: 1.42, color: 'rgba(255,255,255,0.94)' }}>{text}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      {[['2,847', 'Total words'], ['🔥 12', 'Day streak']].map(([v, l]) => (
                        <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{v}</div>
                          <div style={{ fontSize: 9, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {([['Hope', 0.82], ['Resolve', 0.64], ['Calm', 0.5]] as [string, number][]).map(([name, score]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10.5, width: 56, flexShrink: 0, color: 'rgba(255,255,255,0.8)' }}>{name}</span>
                          <span style={{ flex: 1, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                            <span style={{ display: 'block', height: '100%', width: `${score * 100}%`, background: 'linear-gradient(90deg, #F0C18A, var(--accent))', borderRadius: 100 }} />
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.85)' }}>LUMINALOG</span>
                      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>Photo · Unsplash</span>
                    </div>
                  </div>
                </div>
                <div style={{ position: 'absolute', zIndex: 3, bottom: -16, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--hairline2)', borderRadius: 100, padding: '9px 18px', boxShadow: 'var(--shadow)', fontSize: 13, fontWeight: 600, color: 'var(--accentDeep)', whiteSpace: 'nowrap' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v14"/></svg>
                  Share today&apos;s card
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONVERSE (DARK) ── */}
      <section className="fade-up" style={{ padding: '104px 0', background: 'var(--dark-bg)' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Two ways to talk</span>
          <h2 className="serif" style={{ marginTop: 16, color: 'var(--dark-text)', fontSize: 'clamp(28px,3.6vw,44px)', letterSpacing: '-0.025em' }}>Talk to your journal.</h2>
          <p style={{ marginTop: 16, fontSize: 18, color: 'var(--dark-text2)', maxWidth: 520, margin: '16px auto 0', lineHeight: 1.65 }}>Text or live voice. Your companion has read, watched, and listened to everything.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 28, alignItems: 'flex-end', margin: '48px 0 40px' }} className="converse-phones">
            {/* Chat phone */}
            <div style={{ transform: 'rotate(-3deg)' }}>
              <div className="phone dark" style={{ width: 240, height: 520 }}>
                <div className="phone-island" />
                <div className="phone-bar" />
                <div style={{ paddingTop: 48 }}>
                  <div style={{ padding: '6px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accentDeep))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>✦</div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark-text)' }}>Lumina</span>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ maxWidth: '85%', background: 'var(--dark-surface)', border: '1px solid var(--dark-hairline)', borderRadius: '18px 18px 18px 4px', padding: '12px 14px' }}>
                      <div className="serif" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--dark-text)' }}>&ldquo;I&apos;ve noticed that the anxiety you described in last Thursday&apos;s entry — it appeared in February too, right before your last career transition. Is that pattern visible to you now?&rdquo;</div>
                    </div>
                    <div className="bubble-user">I hadn&apos;t connected those two at all.</div>
                    <div style={{ maxWidth: '85%', background: 'var(--dark-surface)', border: '1px solid var(--dark-hairline)', borderRadius: '18px 18px 18px 4px', padding: '12px 14px' }}>
                      <div className="serif" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--dark-text)' }}>&ldquo;What&apos;s useful about seeing it now?&rdquo;</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ color: 'var(--accent)', fontSize: 22, alignSelf: 'center', opacity: 0.6 }}>✦</div>
            {/* Voice phone */}
            <div style={{ transform: 'rotate(3deg)' }}>
              <div className="phone dark" style={{ width: 240, height: 520 }}>
                <div className="phone-island" />
                <div className="phone-bar" />
                <div style={{ paddingTop: 48 }}>
                  <div style={{ padding: '6px 16px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--dark-text2)' }}>Live voice call</div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 380 }}>
                    <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="orb-ring" />
                      <div className="orb-ring" />
                      <div className="orb-ring" />
                      <div className="orb" />
                    </div>
                    <div style={{ marginTop: 24, fontSize: 13, fontWeight: 600, color: 'var(--dark-text2)', letterSpacing: '0.04em' }}>AI listening…</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 16, height: 28 }}>
                      {[...Array(8)].map((_, i) => <div key={i} className="wave-bar" />)}
                    </div>
                    <div className="serif" style={{ marginTop: 24, fontStyle: 'italic', fontSize: 12, color: 'var(--dark-text2)', maxWidth: 160, textAlign: 'center', lineHeight: 1.5 }}>&ldquo;It already knows<br />your whole story.&rdquo;</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 48 }} className="converse-copy-row">
            {[
              ['Text chat', 'Think out loud. Untangle a decision. Ask about a pattern you\'ve noticed. The AI replies in full, drawing on your biography and your entire journal — never generic, always yours.'],
              ['Voice call', 'A real-time voice conversation with a companion that already knows your story. It listens with context, asks the questions you need, and notices what you leave out. The more you talk it through out loud, the more articulate you become — your thinking and your words grow sharper every conversation. Live calls run on Voice Credits, bought separately — so you only pay for the minutes you use.'],
            ].map(([title, desc]) => (
              <div key={title as string} style={{ maxWidth: 280, textAlign: 'center' }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--dark-text)', marginBottom: 10 }}>{title}</h4>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--dark-text2)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY ── */}
      <section className="fade-up" id="privacy" style={{ padding: '104px 0', background: 'var(--surfaceAlt)' }}>
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span className="eyebrow">Privacy & trust</span>
            <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px,3.8vw,44px)', fontWeight: 600, letterSpacing: '-0.025em' }}>Zero-knowledge by design.<br />Verifiable by code.</h2>
            <p style={{ marginTop: 16, fontSize: 18, color: 'var(--text2)', lineHeight: 1.65 }}>Your journal holds the most private data you own. It stays yours — end-to-end encrypted, with the keys derived on your own device, so your entries reach us already sealed. What you share with the AI is always up to you.</p>
          </div>
          <div style={{ background: 'var(--surfaceAlt)', borderRadius: 28, padding: 4, boxShadow: 'var(--shadow)' }}>
            <div style={{ background: 'var(--surface)', borderRadius: 25, padding: '40px 44px' }} className="privacy-inner">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 48px' }} className="privacy-grid">
                {[
                  ['🔒', 'Zero-knowledge encryption', "End-to-end encrypted. We can't read your entries — and neither can anyone else. The keys are derived on your device and never leave it, so everything reaches our servers already sealed."],
                  ['📱', 'On-device dictation & search', "Voice dictation, handwriting recognition (OCR), and the semantic search that finds relevant entries all run on your own device."],
                  ['🎯', 'You choose what the AI sees', "What you share with the AI is up to you — your journal entries plus the biography and profile details you provide, which can include personal, identifying information. Share as much or as little as you like; anything you keep private stays out entirely."],
                  ['🚫', 'Never used to train AI', "Your journal is never used to train AI models. Not ours. Not anyone else's. Full stop."],
                  ['⭐', 'Open source', 'The iOS app and backend API are publicly available on GitHub. Our privacy claims are not trust — they are code anyone can read and verify.'],
                  ['🗑️', 'Full deletion, always', 'Delete your account and everything goes with it — every entry, every AI vector, every media file. Permanently. One tap. No retention.'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accentTint)', color: 'var(--accentDeep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>{icon}</div>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>{title}</h4>
                      <p style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.55 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22, textAlign: 'center' }}>
                <a href="https://github.com/konradgnat/luminalog" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600, transition: 'color .15s' }}>View on GitHub →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="fade-up" id="how" style={{ padding: '104px 0', background: 'var(--bg)' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Getting started</span>
          <h2 className="serif" style={{ marginTop: 16, fontSize: 'clamp(30px,3.8vw,44px)', fontWeight: 600, letterSpacing: '-0.025em' }}>Simple from day one.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginTop: 56, position: 'relative' }} className="steps-row">
            <div style={{ position: 'absolute', top: 54, left: 'calc(33.33% + 20px)', right: 'calc(33.33% + 20px)', height: 2, borderTop: '2px dashed rgba(206,127,68,0.35)', pointerEvents: 'none' }} className="hidden md:block" />
            {[
              { num: '1', icon: '+', title: 'Capture', desc: 'Write, speak, film, or photograph your handwritten page. One tap, any format, all in one place.' },
              { num: '2', icon: '✦', title: 'Reflect', desc: 'Get AI insights, pattern analysis, and five new questions from each entry. Every morning, one personalized prompt drawn from your recent life.' },
              { num: '3', icon: '💬', title: 'Converse', desc: 'Open a text or voice conversation with your AI companion. It already knows your whole story — and it uses all of it.' },
            ].map(({ num, title, desc }) => (
              <div key={num} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 22, padding: '30px 26px 28px', boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
                <div className="serif" style={{ fontSize: 80, fontWeight: 600, color: 'var(--accentSoft)', position: 'absolute', top: -14, right: 20, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>{num}</div>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accentTint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, position: 'relative', fontSize: 20 }}>✦</div>
                <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="fade-up" id="pricing" style={{ padding: '104px 0', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Pricing</span>
          <h2 className="serif" style={{ marginTop: 16, fontSize: 'clamp(30px,3.8vw,44px)', fontWeight: 600, letterSpacing: '-0.025em' }}>Simple, honest pricing.</h2>
          <p style={{ marginTop: 14, fontSize: 18, color: 'var(--text2)' }}>Monthly or annual — the whole app, no tiers. Live voice calls run on add-on Voice Credits.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 640, margin: '50px auto 0' }} className="plans">
            {/* Monthly */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline2)', borderRadius: 24, padding: '32px 30px', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text3)' }}>Monthly</div>
              <div className="serif" style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.025em', margin: '14px 0 4px' }}>$9.99 <span style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 500, color: 'var(--text2)' }}>/ month</span></div>
              <div style={{ fontSize: 14, color: 'var(--text3)' }}>Cancel anytime</div>
              <ul style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Unlimited text, voice, video & photo entries', 'AI video intelligence (face + voice)', 'Unlimited AI insights & patterns', 'Unlimited chat with your companion', 'Daily 750-word streak + shareable insights card', 'Daily personalized prompt'].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, textAlign: 'left' }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 28 }}>
                <a href="#waitlist" className="btn-amber-full">Join the waitlist</a>
              </div>
            </div>
            {/* Annual */}
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--accent)', borderRadius: 24, padding: '32px 30px', boxShadow: '0 2px 4px rgba(70,50,30,0.06), 0 20px 52px rgba(185,107,51,0.18)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--accent), var(--accentDeep))' }} />
              <div style={{ position: 'absolute', top: 18, right: 18, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100 }}>Save 17%</div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accentDeep)' }}>Annual</div>
              <div className="serif" style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.025em', margin: '14px 0 4px' }}>$99.99 <span style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 500, color: 'var(--text2)' }}>/ year</span></div>
              <div style={{ fontSize: 14, color: 'var(--text3)' }}>~$8.33 / month · billed once a year</div>
              <ul style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Everything in Monthly', 'Two months free', 'Full year of compounding self-knowledge'].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, textAlign: 'left' }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 28 }}>
                <a href="#waitlist" className="btn-amber-full">Join the waitlist</a>
              </div>
              <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text3)', marginTop: 10 }}>Cancel anytime. No tricks.</div>
            </div>
          </div>

          {/* Voice credits add-on */}
          <div style={{ maxWidth: 640, margin: '24px auto 0' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 22, padding: '28px 30px', textAlign: 'left', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accentTint)', color: 'var(--accentDeep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>🎙️</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Live voice calls run on Voice Credits</h3>
              </div>
              <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6 }}>
                Everything in LuminaLog is included in your subscription — writing, voice, video &amp; photo entries, AI insights, chat, and your Journal Constellation. <b style={{ color: 'var(--text)', fontWeight: 600 }}>Real-time voice calls</b> with your companion are the one exception: they&apos;re powered by Voice Credits you buy as you go, so you only ever pay for the minutes you actually talk.
              </p>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--accentDeep)' }}>
                <span style={{ background: 'var(--accentSoft)', padding: '5px 12px', borderRadius: 100 }}>1 credit = $1 = 6 minutes</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[['$4.99', '30 min'], ['$9.99', '60 min'], ['$19.99', '120 min'], ['$49.99', '300 min']].map(([price, mins]) => (
                  <div key={price} style={{ flex: '1 1 120px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{price}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{mins} of talk time</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 14, lineHeight: 1.5 }}>
                Same rate at every pack size — bigger packs just mean fewer interruptions. Voice journaling (recording entries) is always included; credits are only for live calls.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '40px 0 80px' }}>
        <div className="wrap">
          <div style={{ padding: 16 }}>
            <div className="cta-final" style={{ position: 'relative', overflow: 'hidden', borderRadius: 32, background: 'linear-gradient(155deg, var(--accent), var(--accentDeep))', color: '#fff', padding: '80px 48px', textAlign: 'center', boxShadow: '0 30px 72px rgba(185,107,51,0.34)' }}>
              <div style={{ position: 'absolute', top: -80, right: -50, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.13)', filter: 'blur(10px)' }} />
              <div style={{ position: 'absolute', bottom: -100, left: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.09)', filter: 'blur(10px)' }} />
              <h2 className="serif" style={{ position: 'relative', zIndex: 1, fontSize: 'clamp(30px,4.2vw,52px)', fontWeight: 600, lineHeight: 1.06, letterSpacing: '-0.025em' }}>Merge with AI.<br />One conversation at a time.</h2>
              <p className="serif" style={{ position: 'relative', zIndex: 1, fontStyle: 'italic', fontSize: 26, color: 'rgba(255,255,255,0.88)', marginTop: 14 }}>It starts with one entry.</p>
              <p style={{ position: 'relative', zIndex: 1, fontSize: 17, color: 'rgba(255,255,255,0.75)', marginTop: 10 }}>$9.99 / month or $99.99 / year. Be first in line when we open.</p>
              <div style={{ position: 'relative', zIndex: 1, marginTop: 36, display: 'flex', justifyContent: 'center' }}>
                <WaitlistForm variant="onAccent" source="final-cta" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '52px 0 60px' }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <a href="#top" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
                  <Image src="/logo.svg" width={32} height={32} alt="" />
                </span>
                LuminaLog
              </a>
              <p className="serif" style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--text2)', marginTop: 14, maxWidth: 280 }}>Merge with AI through daily conversation with your journaling companion.</p>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6 }}>
              {[['Blog', '/blog'], ['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Send me a tweet', 'https://x.com/konrad_gnat'], ['Support', 'mailto:konradmgnat@gmail.com'], ['GitHub', 'https://github.com/konradgnat/luminalog']].map(([label, href]) => (
                <a key={label} href={href} style={{ fontSize: 14, color: 'var(--text2)', transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accentDeep)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
                  {label}
                </a>
              ))}
            </div>
          </div>
          <p style={{ marginTop: 36, fontSize: 13, color: 'var(--text3)' }}>
            © 2026 LuminaLog · Built by{' '}
            <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Konrad Gnat</a>
          </p>
        </div>
      </footer>

    </>
  )
}
