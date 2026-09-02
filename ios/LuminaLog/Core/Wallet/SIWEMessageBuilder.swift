import Foundation

/// Builds an EIP-4361 ("Sign-In with Ethereum") message client-side (spec 5.2).
/// Pure and deterministic given its inputs except for `Date()`; the server
/// (`viem/siwe`'s `parseSiweMessage`) only validates `domain`, `nonce`, and
/// `chainId` (`server/src/routes/auth.ts`), so this format matches the EIP-4361
/// ABNF closely enough to parse, without over-fitting fields the server ignores.
enum SIWEMessageBuilder {
    static func build(
        nonce: String,
        address: String,
        chainId: Int,
        domain: String = "myargoquest.com",
        uri: String = "https://myargoquest.com",
        statement: String = "Sign in to Argo with your Ethereum account.",
        issuedAt: Date = Date()
    ) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let issuedAtString = formatter.string(from: issuedAt)

        return """
        \(domain) wants you to sign in with your Ethereum account:
        \(address)

        \(statement)

        URI: \(uri)
        Version: 1
        Chain ID: \(chainId)
        Nonce: \(nonce)
        Issued At: \(issuedAtString)
        """
    }
}
