import { CONTEST_RULES } from '@/lib/contest/config'

/**
 * The canonical rules, rendered from `CONTEST_RULES` so the page, the form and
 * `/mybw2026-contest/skill.md` can never disagree about what the rules are.
 */
export default function RulesList({ highlight }: { highlight?: string[] }) {
  return (
    <ol style={{ display: 'grid', gap: 12, counterReset: 'rule', listStyle: 'none', padding: 0 }}>
      {CONTEST_RULES.map((rule, i) => {
        const on = highlight?.includes(rule.id)
        return (
          <li
            key={rule.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: on ? '12px 14px' : 0,
              borderRadius: on ? 12 : 0,
              background: on ? 'var(--accentSoft)' : 'transparent',
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: 999,
                background: 'var(--accentTint)',
                color: 'var(--accentDeep)',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 3,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 16, lineHeight: 1.62, color: 'var(--text2)' }}>{rule.text}</span>
          </li>
        )
      })}
    </ol>
  )
}
