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

const getPagesBasePath = () => {
  const repository = process.env.GITHUB_REPOSITORY;
  const owner = process.env.GITHUB_REPOSITORY_OWNER;

  if (!repository || !owner) return '';

  const repoName = repository.split('/')[1] ?? '';
  const userPagesRepo = `${owner.toLowerCase()}.github.io`;

  if (!repoName || repoName.toLowerCase() === userPagesRepo) return '';

  return `/${repoName}`;
};

const pagesBasePath = getPagesBasePath();

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true
  },
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath || undefined
};

export default withPwa(nextConfig);
