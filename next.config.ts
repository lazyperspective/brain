import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Sketchbook is a static site copied into public/ at build time (see "prebuild").
  async redirects() {
    return [
      { source: "/sketchbook", destination: "/sketchbook/index.html", permanent: false },
      { source: "/sketchbook/", destination: "/sketchbook/index.html", permanent: false },
    ];
  },
};

export default nextConfig;
