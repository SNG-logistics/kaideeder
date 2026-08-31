/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    output: 'standalone',
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'kaideeder.com', pathname: '/**' },
            { protocol: 'https', hostname: 'www.kaideeder.com', pathname: '/**' },
            { protocol: 'http', hostname: 'localhost', pathname: '/**' },
            { protocol: 'https', hostname: 'localhost', pathname: '/**' },
            { protocol: 'https', hostname: 'imgs.deltafood.me', pathname: '/**' },
            { protocol: 'https', hostname: 'deltafoodpicture.sgp1.digitaloceanspaces.com', pathname: '/**' },
        ]
    },
    outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
