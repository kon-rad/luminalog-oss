/** @type {import('next').NextConfig} */
const nextConfig = {
  // Defaults to .next. Override so a `next dev` and a `next start` preview can
  // run side by side without overwriting each other's build manifests, which
  // shows up as the dev server serving 404s for its own chunks:
  //   NEXT_DIST_DIR=.next-dev npm run dev
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  experimental: {
    // Keep native ONNX runtime + transformers out of the webpack bundle; they are
    // required at runtime from node_modules (bundling their .node binaries fails).
    serverComponentsExternalPackages: ['onnxruntime-node', '@huggingface/transformers'],
  },
  async redirects() {
    // The course moved under /courses and was later renamed. Keep old links working.
    return [
      { source: '/courses/kids-stem/what-is-ai', destination: '/courses/kids-stem/module-1', permanent: true },
      { source: '/courses/kids-stem/what-is-blockchain', destination: '/courses/kids-stem/module-2', permanent: true },
      { source: '/ai-power-users', destination: '/courses/ai-agent-pro', permanent: true },
      { source: '/ai-power-users/:path*', destination: '/courses/ai-agent-pro/:path*', permanent: true },
      // Renamed from "AI Power Users" to "AI Agent Pro". Luma events for
      // modules 1-7 were published against the old path, so it has to keep
      // resolving.
      { source: '/courses/ai-power-users', destination: '/courses/ai-agent-pro', permanent: true },
      { source: '/courses/ai-power-users/:path*', destination: '/courses/ai-agent-pro/:path*', permanent: true },
      // The founding preorder is retired (design 2026-08-23, section 5): it
      // sold zero subscriptions and /pricing is now the real checkout. Both
      // URLs were shared publicly, so they redirect rather than 404.
      { source: '/founding', destination: '/pricing', permanent: true },
      { source: '/founding/thanks', destination: '/pricing', permanent: true },
    ]
  },
}

module.exports = nextConfig
