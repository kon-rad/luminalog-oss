// CAIP-122-shaped Sign-In with Solana message text. The exact line shape here
// MUST match server/src/routes/authSolana.ts's parseSiwsMessage: line 1 is the
// domain sign-in line, line 2 is the bare address, and a "Nonce: " line carries
// the server-issued nonce. This is a format contract (a mismatch is a bug), NOT
// a frozen key-derivation contract (see the DISTINCT fixed message in
// solanaWallet.ts, stage 3): no key material derives from this text.

export interface SiwsMessageParams {
  domain: string
  address: string
  statement: string
  uri: string
  nonce: string
  issuedAt: string
}

export function buildSiwsMessage(params: SiwsMessageParams): string {
  const { domain, address, statement, uri, nonce, issuedAt } = params
  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    'Version: 1',
    'Chain ID: solana:mainnet',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n')
}
