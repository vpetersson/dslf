#!/usr/bin/env bun

/**
 * SEO files generator (sitemap.xml and robots.txt)
 * Generates sitemap and robots.txt for better search engine optimization
 */

import { readFileSync } from "fs";
import { exists, mkdir, writeFile } from "fs/promises";

import { parseConfig } from "./config/parser";

/**
 * Generate sitemap.xml content
 */
function generateSitemap(siteUrl: string): string {
  // Remove trailing slash if present
  const baseUrl = siteUrl.replace(/\/$/, "");
  const today = new Date().toISOString().split("T")[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
}

/**
 * Generate robots.txt content
 */
function generateRobotsTxt(siteUrl?: string): string {
  const sitemapLine = siteUrl ? `\nSitemap: ${siteUrl.replace(/\/$/, "")}/sitemap.xml` : "";

  return `# robots.txt for DSLF
User-agent: *
Allow: /

# Disallow error pages
Disallow: /404.html
${sitemapLine}`;
}

async function generateSeoFiles() {
  try {
    // Create dist directory if it doesn't exist
    await mkdir("dist", { recursive: true });

    let siteUrl: string | undefined;

    // Try to read site_url from config
    const configExists = await exists("link-index.yaml");
    if (configExists) {
      try {
        const yamlContent = readFileSync("link-index.yaml", "utf-8");
        const config = parseConfig(yamlContent);
        siteUrl = config.seo?.site_url;
      } catch {
        // Config parsing failed, continue without site_url
      }
    }

    // Generate robots.txt (always)
    const robotsTxt = generateRobotsTxt(siteUrl);
    await writeFile("dist/robots.txt", robotsTxt);
    console.log("[OK] Generated dist/robots.txt");

    // Generate sitemap.xml only if site_url is configured
    if (siteUrl) {
      const sitemap = generateSitemap(siteUrl);
      await writeFile("dist/sitemap.xml", sitemap);
      console.log("[OK] Generated dist/sitemap.xml");
      console.log(`     Site URL: ${siteUrl}`);
    } else {
      console.log("[SKIP] sitemap.xml - No seo.site_url configured in link-index.yaml");
    }
  } catch (error) {
    console.error("[FAIL] Error generating SEO files:", error);
    process.exit(1);
  }
}

// Run the generator
void generateSeoFiles();
