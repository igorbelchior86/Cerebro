import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

const configuredApiBase = process.env.NEXT_PUBLIC_API_URL || '';
const apiProxyTarget = process.env.API_PROXY_TARGET
  || (/^https?:\/\//i.test(configuredApiBase) ? configuredApiBase : 'http://localhost:3001');

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (webpackConfig, { dev }) => {
    if (dev) {
      webpackConfig.cache = false;
    }
    return webpackConfig;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default withNextIntl(config);
