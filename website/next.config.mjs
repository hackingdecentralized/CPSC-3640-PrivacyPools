// Static export (GitHub Pages) is opt-in: set NEXT_PUBLIC_BASE_PATH (e.g. /CPSC-3640-PrivatePools, the repo name)
// or STATIC_EXPORT=1 at build time. Without either, this is the normal server build used by `pnpm dev`.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
const staticExport = basePath !== '' || process.env.STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport && {
    output: 'export',
    basePath,
    assetPrefix: basePath,
    // GitHub Pages serves /asp/ from asp/index.html.
    trailingSlash: true,
    // There is no image optimisation server in a static export.
    images: { unoptimized: true },
  }),
  // Inlined for client code that builds public-file URLs by hand (src/utils/basePath.ts).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
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
  // Headers configuration for Safe App compatibility. A static export cannot set headers, so it has none.
  ...(!staticExport && { headers }),
};

async function headers() {
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
}

export default nextConfig;
