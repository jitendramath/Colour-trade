/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // सर्वर पर इमेज लोड होने में दिक्कत न आए
  images: {
    domains: ['damanclub.asia'], 
    unoptimized: true,
  },
  // अगर तुम Vercel के अलावा कहीं और (जैसे VPS/Render) होस्ट कर रहे हो:
  output: 'standalone',
};

module.exports = nextConfig;
