import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@v-gold/core', '@v-gold/database', '@v-gold/ai-gateway'],
};

export default nextConfig;
