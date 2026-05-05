import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@perfin/ui', '@perfin/db'],
  experimental: { typedRoutes: true },
};

export default config;
