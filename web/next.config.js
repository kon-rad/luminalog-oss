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
    // The AI Power Users course moved under /courses. Keep old links working.
    return [
      { source: '/courses/kids-stem/what-is-ai', destination: '/courses/kids-stem/module-1', permanent: true },
      { source: '/courses/kids-stem/what-is-blockchain', destination: '/courses/kids-stem/module-2', permanent: true },
      { source: '/ai-power-users', destination: '/courses/ai-power-users', permanent: true },
      { source: '/ai-power-users/:path*', destination: '/courses/ai-power-users/:path*', permanent: true },
    ]
  },
}

module.exports = nextConfig
