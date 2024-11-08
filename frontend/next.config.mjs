/** @type {import('next').NextConfig} */
const nextConfig = {
    output: process.env.NEXT_OUTPUT || 'standalone',
    basePath: "/poc-ui",
    reactStrictMode: false,
};

export default nextConfig;
