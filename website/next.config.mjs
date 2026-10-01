/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip ESLint during builds (run in pre-commit hooks instead)
  // ESLint is also part of pnpm run build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Turbopack configuration
  turbopack: {
    rules: {
      // Handle .wasm files as assets
      '*.wasm': {
        loaders: ['file-loader'],
        as: '*.wasm',
      },
      // Handle .zkey files as assets
      '*.zkey': {
        loaders: ['file-loader'],
        as: '*.zkey',
      },
    },
  },
  // Server-side external packages (replaces webpack externals)
  serverExternalPackages: ['pino-pretty', 'encoding'],
  // Webpack fallback for development (when not using Turbopack)
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      fs: false,
    };

    // Optimize cache for large strings (ABIs)
    config.cache = {
      ...config.cache,
      compression: 'gzip',
      maxMemoryGenerations: 1,
    };

    // Add loader for .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Add loader for .zkey files
    config.module.rules.push({
      test: /\.zkey$/,
      type: 'asset/resource',
    });

    return config;
  },
  // Headers configuration for Safe App compatibility
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Allow framing from same origin and Safe domains
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://app.safe.global https://*.safe.global https://safe.global;",
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Allow requests from any origin for manifest.json
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, content-type, Authorization',
          },
        ],
      },
      {
        // Specific headers for manifest.json
        source: '/manifest.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600', // Cache for 1 hour
          },
        ],
      },
    ];
  },
};

export default nextConfig;
