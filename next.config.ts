import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sqlite-vec", "tree-sitter-typescript", "web-tree-sitter"],
};

export default nextConfig;
