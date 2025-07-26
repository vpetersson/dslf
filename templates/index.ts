#!/usr/bin/env bun

import { readFileSync } from "fs";
import { exists, mkdir, writeFile } from "fs/promises";

import { generateIndexHtml, parseYaml, validateConfig } from "./index-utils";

async function generateIndexPage() {
  try {
    // Check if link-index.yaml exists
    const configExists = await exists("link-index.yaml");

    if (!configExists) {
      console.log("⚠️  link-index.yaml not found - skipping index.html generation");
      console.log("   Create a link-index.yaml file to enable the Link Index page");
      return;
    }

    // Read and parse the configuration
    const yamlContent = readFileSync("link-index.yaml", "utf-8");
    const config = parseYaml(yamlContent);

    // Validate required fields
    if (!validateConfig(config)) {
      console.log("⚠️  Invalid link-index.yaml - missing required profile fields (name, bio)");
      return;
    }

    // Create dist directory if it doesn't exist
    await mkdir("dist", { recursive: true });

    // Generate and write the index.html file
    const html = generateIndexHtml(config);
    await writeFile("dist/index.html", html);

    console.log("✅ Generated dist/index.html successfully!");
    console.log(`   Profile: ${config.profile.name}`);

    const socialCount = config.social
      ? Object.keys(config.social).filter(key => config.social?.[key]).length
      : 0;
    const linksCount = config.links
      ? Object.keys(config.links).filter(key => config.links?.[key]).length
      : 0;

    if (socialCount > 0) {
      console.log(`   Social links: ${socialCount}`);
    }
    if (linksCount > 0) {
      console.log(`   Custom links: ${linksCount}`);
    }
  } catch (error) {
    console.error("❌ Error generating index page:", error);
    process.exit(1);
  }
}

// Run the generator
void generateIndexPage();
