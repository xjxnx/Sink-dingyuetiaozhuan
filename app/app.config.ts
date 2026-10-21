export default defineAppConfig({
  title: 'ZheLink',
  documentation: 'https://github.com/xjxnx/Sink-dingyuetiaozhuan/tree/master/docs',
  github: 'https://github.com/xjxnx/Sink-dingyuetiaozhuan',
  githubBranch: 'master',
  coffee: 'https://www.paypal.com/ncp/payment/ZD9FZ84DDQ4TN',
  twitter: '',
  telegram: '',
  description: 'A Simple / Speedy / Secure Link Shortener with Analytics, 100% run on Cloudflare.',
  image: '/zhelink-banner.png',
  previewTTL: 300, // 5 minutes
  slugRegex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
  reserveSlug: [
    'dashboard',
  ],
})
