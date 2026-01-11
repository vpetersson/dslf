#!/usr/bin/env bun

import { readFileSync } from "fs";
import { exists, mkdir, writeFile } from "fs/promises";

import { parseConfig } from "./config/parser";
import { generateIndexHtml } from "./index-utils";

async function generateIndexPage() {
  try {
    // Check if link-index.yaml exists
    const configExists = await exists("link-index.yaml");

    if (!configExists) {
      console.log("[SKIP] link-index.yaml not found - skipping index.html generation");
      console.log("       Create a link-index.yaml file to enable the Link Index page");
      return;
    }

    // Read and parse the configuration (validation is built-in)
    const yamlContent = readFileSync("link-index.yaml", "utf-8");
    const config = parseConfig(yamlContent);

    // Create dist directory if it doesn't exist
    await mkdir("dist", { recursive: true });

    // Generate and write the index.html file
    const html = generateIndexHtml(config);
    await writeFile("dist/index.html", html);

    console.log("[OK] Generated dist/index.html");
    console.log(`     Profile: ${config.profile.name}`);
    console.log(`     Theme: ${config.theme?.preset ?? "mocha"} (Catppuccin)`);

    const socialCount = config.social
      ? Object.keys(config.social).filter(key => config.social?.[key]).length
      : 0;
    const linksCount = config.links?.length ?? 0;

    if (socialCount > 0) {
      console.log(`     Social links: ${socialCount}`);
    }
    if (linksCount > 0) {
      console.log(`     Custom links: ${linksCount}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("[FAIL] Error generating index page:");
      console.error(error.message);
    } else {
      console.error("[FAIL] Error generating index page:", error);
    }
    process.exit(1);
  }
}

// Run the generator
void generateIndexPage();
