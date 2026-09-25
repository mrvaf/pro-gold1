import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@v-gold/core', '@v-gold/database', '@v-gold/ai-gateway'],
  allowedDevOrigins: ['localhost', '127.0.0.1', '169.254.83.107'],
};

export default nextConfig;
