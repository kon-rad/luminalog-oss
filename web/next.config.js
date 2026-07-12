/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  experimental: {
    // Keep native ONNX runtime + transformers out of the webpack bundle; they are
    // required at runtime from node_modules (bundling their .node binaries fails).
    serverComponentsExternalPackages: ['onnxruntime-node', '@huggingface/transformers'],
  },
}

module.exports = nextConfig
