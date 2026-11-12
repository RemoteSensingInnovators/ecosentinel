/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@google/earthengine"],
  // Loyihada ESLint sozlanmagan; tiplar `tsc` orqali tekshiriladi
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
