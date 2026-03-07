/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    output: 'standalone',
    images: {
        domains: [
            'kaideeder.com',
            'www.kaideeder.com',
            'localhost',
            'imgs.deltafood.me',
            'deltafoodpicture.sgp1.digitaloceanspaces.com'
        ]
    },
    outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig

