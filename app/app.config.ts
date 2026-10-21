export default defineAppConfig({
  title: 'Sink',
  documentation: 'https://github.com/xjxnx/Sink-dingyuetiaozhuan/tree/master/docs',
  github: 'https://github.com/xjxnx/Sink-dingyuetiaozhuan',
  githubBranch: 'master',
  coffee: '',
  twitter: '',
  telegram: '',
  description: 'A Simple / Speedy / Secure Link Shortener with Analytics, 100% run on Cloudflare.',
  image: '/banner.png',
  previewTTL: 300, // 5 minutes
  slugRegex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
  reserveSlug: [
    'dashboard',
  ],
})
