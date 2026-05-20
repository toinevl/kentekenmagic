import type { NextConfig } from "next";

const isExport = process.env.NEXT_BUILD_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export" } : {}),
  images: {
    unoptimized: true
  },
  ...(!isExport ? {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:7071/api/:path*"
        }
      ];
    }
  } : {})
};

export default nextConfig;
