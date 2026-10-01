/**
 * The path the site is served under: '' locally, '/<repo>' on GitHub Pages (set by next.config.mjs from
 * NEXT_PUBLIC_BASE_PATH). Next adds it to <Link> and router URLs itself, but not to hand-built URLs for files in
 * public/ (next/image with unoptimized images, fetches), so those go through withBasePath.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefix a root-absolute public path, e.g. '/logo.svg' -> '/CPSC-3640-PrivatePools/logo.svg'. */
export const withBasePath = (path: string): string => `${BASE_PATH}${path}`;
