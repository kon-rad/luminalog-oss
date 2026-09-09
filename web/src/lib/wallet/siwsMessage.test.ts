import { describe, it, expect } from 'vitest'
import { buildSiwsMessage } from './siwsMessage'

describe('buildSiwsMessage', () => {
  const params = {
    domain: 'myargoquest.com',
    address: '7cVfgArCheMR6Cs4t6vz5rfnqd56vZq4ndaBrY5xkxXy',
    statement: 'Sign in to Argo.',
    uri: 'https://myargoquest.com',
    nonce: 'abc123',
    issuedAt: '2026-09-08T00:00:00.000Z',
  }

  it('starts with the domain sign-in line', () => {
    const msg = buildSiwsMessage(params)
    expect(msg.split('\n')[0]).toBe('myargoquest.com wants you to sign in with your Solana account:')
  })

  it('places the bare address on line 2', () => {
    const msg = buildSiwsMessage(params)
    expect(msg.split('\n')[1]).toBe(params.address)
  })

  it('includes a Nonce: line with the exact nonce', () => {
    const msg = buildSiwsMessage(params)
    expect(msg.split('\n')).toContain(`Nonce: ${params.nonce}`)
  })

  it('includes the statement, URI, version, chain id, and issued-at', () => {
    const msg = buildSiwsMessage(params)
    expect(msg).toContain(params.statement)
    expect(msg).toContain(`URI: ${params.uri}`)
    expect(msg).toContain('Version: 1')
    expect(msg).toContain('Chain ID: solana:mainnet')
    expect(msg).toContain(`Issued At: ${params.issuedAt}`)
  })

  it('builds the exact whole message byte-for-byte, not just the right fragments', () => {
    const msg = buildSiwsMessage(params)
    const expected = [
      `${params.domain} wants you to sign in with your Solana account:`,
      params.address,
      '',
      params.statement,
      '',
      `URI: ${params.uri}`,
      'Version: 1',
      'Chain ID: solana:mainnet',
      `Nonce: ${params.nonce}`,
      `Issued At: ${params.issuedAt}`,
    ].join('\n')
    expect(msg).toBe(expected)
  })
})
