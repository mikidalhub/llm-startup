const isProduction = process.env.NODE_ENV === 'production';
let withPwa = (config) => config;

if (isProduction) {
  const { default: nextPwa } = await import('next-pwa');
  withPwa = nextPwa({
    dest: 'public',
    register: true,
    skipWaiting: true
  });
}

const nextConfig = {
  reactStrictMode: true
};

export default withPwa(nextConfig);
