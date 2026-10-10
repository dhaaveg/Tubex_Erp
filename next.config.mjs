/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
  async rewrites() {
    return [
      {
        source: '/dhaaveg',
        destination: '/',
      },
      {
        source: '/dhaaveg/:path*',
        destination: '/:path*',
      },
    ];
  },
};

export default nextConfig;
