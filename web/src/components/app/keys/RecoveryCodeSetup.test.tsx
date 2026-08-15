// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecoveryCodeSetup, { challengeIndices } from './RecoveryCodeSetup'

const CODE = 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH-JJJJ-KKKK-MMMM-NNNN-PPPP'

beforeEach(() => {
  // jsdom implements neither, and the download path calls both.
  global.URL.createObjectURL = vi.fn(() => 'blob:x')
  global.URL.revokeObjectURL = vi.fn()
})

describe('challengeIndices', () => {
  it('picks two distinct in-range groups', () => {
    const picks = challengeIndices(CODE)
    expect(picks).toHaveLength(2)
    expect(new Set(picks).size).toBe(2)
    for (const i of picks) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(13)
    }
  })

  it('is deterministic for a given code', () => {
    expect(challengeIndices(CODE)).toEqual(challengeIndices(CODE))
  })

  it('differs across codes', () => {
    const other = CODE.replace('AAAA', 'ZZZZ')
    expect(challengeIndices(other)).not.toEqual(challengeIndices(CODE))
  })

  it('does not hang on a single-group code', () => {
    expect(challengeIndices('ABCD')).toEqual([0])
  })
})

describe('RecoveryCodeSetup', () => {
  const answerCorrectly = () => {
    const groups = CODE.split('-')
    for (const i of challengeIndices(CODE)) {
      fireEvent.change(screen.getByLabelText(`Group ${i + 1}`), { target: { value: groups[i] } })
    }
  }

  it('displays the full code', () => {
    render(<RecoveryCodeSetup code={CODE} onAcknowledged={vi.fn()} />)
    expect(screen.getByText(CODE)).toBeTruthy()
  })

  it('blocks until the code is saved AND the challenge is answered', () => {
    const onAcknowledged = vi.fn()
    render(<RecoveryCodeSetup code={CODE} onAcknowledged={onAcknowledged} />)

    const proceed = screen.getByRole('button', { name: /i saved my code/i }) as HTMLButtonElement
    expect(proceed.disabled).toBe(true)

    // Answering without saving is not enough.
    answerCorrectly()
    expect(proceed.disabled).toBe(true)

    // Downloading marks it saved and unblocks.
    fireEvent.click(screen.getByRole('button', { name: /download/i }))
    expect(proceed.disabled).toBe(false)

    fireEvent.click(proceed)
    expect(onAcknowledged).toHaveBeenCalledOnce()
  })

  it('blocks when the code is saved but the challenge is unanswered', () => {
    render(<RecoveryCodeSetup code={CODE} onAcknowledged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /download/i }))
    const proceed = screen.getByRole('button', { name: /i saved my code/i }) as HTMLButtonElement
    expect(proceed.disabled).toBe(true)
  })

  it('rejects a wrong group answer', () => {
    render(<RecoveryCodeSetup code={CODE} onAcknowledged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    for (const i of challengeIndices(CODE)) {
      fireEvent.change(screen.getByLabelText(`Group ${i + 1}`), { target: { value: 'XXXX' } })
    }
    const proceed = screen.getByRole('button', { name: /i saved my code/i }) as HTMLButtonElement
    expect(proceed.disabled).toBe(true)
  })

  it('accepts a lower-case answer, since the input renders upper-case', () => {
    render(<RecoveryCodeSetup code={CODE} onAcknowledged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    const groups = CODE.split('-')
    for (const i of challengeIndices(CODE)) {
      fireEvent.change(screen.getByLabelText(`Group ${i + 1}`), {
        target: { value: groups[i].toLowerCase() },
      })
    }
    const proceed = screen.getByRole('button', { name: /i saved my code/i }) as HTMLButtonElement
    expect(proceed.disabled).toBe(false)
  })
})
