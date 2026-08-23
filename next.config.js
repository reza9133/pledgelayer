/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: this is a purely client-side dApp (all contract reads/writes
  // happen in the browser via genlayer-js + the user's wallet), so there is no
  // server-side rendering or API routes to run on Cloudflare. Static export is
  // the simplest, most reliable way to host it on Cloudflare Pages.
  output: 'export',
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
