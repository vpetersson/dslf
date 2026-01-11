#!/usr/bin/env bun

/**
 * 404 Page Generator
 * Uses Catppuccin theme from config for consistency with the main site
 * Falls back to Mocha (dark) if no config exists
 * @see https://catppuccin.com/
 */

import { readFileSync } from "fs";
import { exists, mkdir, writeFile } from "fs/promises";

import { parseConfig } from "./config/parser";
import { defaultTheme, themePresets, type ThemePreset } from "./theme/presets";

interface ResolvedTheme extends ThemePreset {
  isLight: boolean;
  preset: string;
}

/**
 * Get theme from config file or fall back to default
 */
async function getTheme(): Promise<ResolvedTheme> {
  try {
    const configExists = await exists("link-index.yaml");

    if (configExists) {
      const yamlContent = readFileSync("link-index.yaml", "utf-8");
      const config = parseConfig(yamlContent);
      const presetName = config.theme?.preset ?? "mocha";
      const preset = themePresets[presetName] ?? defaultTheme;

      return {
        ...preset,
        primary: config.theme?.primary ?? preset.primary,
        secondary: config.theme?.secondary ?? preset.secondary,
        isLight: presetName === "latte",
        preset: presetName
      };
    }
  } catch {
    // Fall back to default theme if config parsing fails
  }

  return {
    ...defaultTheme,
    isLight: false,
    preset: "mocha"
  };
}

/**
 * Generate 404 page HTML with the given theme
 */
function generate404Html(theme: ResolvedTheme): string {
  const colorScheme = theme.isLight ? "light" : "dark";
  const particleOpacity = theme.isLight ? "0.08" : "0.1";
  const shadowColor = theme.isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(203, 166, 247, 0.3)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="${colorScheme}">
    <meta name="referrer" content="strict-origin-when-cross-origin">

    <!-- Primary Meta Tags -->
    <title>404 - Page Not Found | DSLF</title>
    <meta name="title" content="404 - Page Not Found | DSLF">
    <meta name="description" content="The page you're looking for could not be found. Return to the main page or explore other sections.">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="${theme.background}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="404 - Page Not Found | DSLF">
    <meta property="og:description" content="The page you're looking for could not be found.">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary">
    <meta property="twitter:title" content="404 - Page Not Found | DSLF">
    <meta property="twitter:description" content="The page you're looking for could not be found.">

    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "404 - Page Not Found",
      "description": "Error page indicating the requested resource was not found",
      "mainEntity": {
        "@type": "Thing",
        "name": "404 Error",
        "description": "HTTP 404 Not Found error"
      }
    }
    </script>

    <!-- Stylesheets -->
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="css/inter.css">
    <link rel="stylesheet" href="css/fontawesome.min.css">

    <!-- Catppuccin ${theme.preset.charAt(0).toUpperCase() + theme.preset.slice(1)} Theme (https://catppuccin.com/) -->
    <style>
        :root {
            --color-primary: ${theme.primary};
            --color-secondary: ${theme.secondary};
            --color-surface: ${theme.surface};
            --color-overlay: ${theme.overlay};
            --color-text: ${theme.text};
            --color-text-muted: ${theme.textMuted};
        }
        body {
            font-family: 'Inter', sans-serif;
            background: ${theme.background};
            color: var(--color-text);
        }
        .glass-effect {
            background: var(--color-surface);
            border: 1px solid var(--color-overlay);
        }
        .gradient-text {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .text-muted {
            color: var(--color-text-muted);
        }
        .btn-primary {
            background: var(--color-primary);
            color: ${theme.isLight ? "#ffffff" : theme.background};
            min-height: 48px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-primary:hover {
            filter: brightness(1.1);
            box-shadow: 0 8px 25px ${shadowColor};
        }
        .btn-primary:active {
            transform: scale(0.98);
        }
        /* Enhanced focus states */
        :focus-visible {
            outline: 2px solid var(--color-primary);
            outline-offset: 2px;
        }
        /* Skip link for accessibility */
        .skip-link {
            position: absolute;
            left: 1rem;
            top: -100%;
            z-index: 50;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 500;
            background: var(--color-primary);
            color: ${theme.isLight ? "#ffffff" : theme.background};
            transition: top 0.2s ease-in-out;
        }
        .skip-link:focus { top: 1rem; }
        /* Fluid typography */
        h1 { font-size: clamp(4rem, 15vw, 8rem); }
        h2 { font-size: clamp(1.25rem, 3vw, 1.875rem); }
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
</head>
<body class="flex items-center justify-center p-4" style="min-height: 100dvh;">
    <!-- Skip link for keyboard accessibility -->
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <main id="main-content" class="glass-effect rounded-2xl p-8 md:p-12 max-w-2xl w-full text-center shadow-2xl" role="main">
        <!-- Error Status -->
        <header class="mb-8">
            <h1 class="font-bold gradient-text animate-gradient-shift" aria-label="Error 404">
                404
            </h1>
        </header>

        <!-- Error message -->
        <section class="mb-8" aria-labelledby="error-heading">
            <h2 id="error-heading" class="text-2xl md:text-3xl font-semibold mb-4">
                Oops! Page not found
            </h2>
            <p class="text-muted text-lg mb-6">
                The page you're looking for seems to have wandered off into the digital void.
                Don't worry, even the best explorers sometimes take a wrong turn.
            </p>
        </section>

        <!-- Decorative elements using theme colors -->
        <div class="mb-8 flex justify-center space-x-4" role="presentation" aria-hidden="true">
            <div class="w-3 h-3 rounded-full animate-bounce" style="background: var(--color-primary);"></div>
            <div class="w-3 h-3 rounded-full animate-bounce" style="background: var(--color-secondary); animation-delay: 0.1s;"></div>
            <div class="w-3 h-3 rounded-full animate-bounce" style="background: var(--color-primary); animation-delay: 0.2s;"></div>
        </div>

        <!-- Navigation -->
        <nav role="navigation" aria-label="Error page navigation">
            <a href="/" class="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium">
                <i class="fas fa-home" aria-hidden="true"></i>
                <span>Return Home</span>
            </a>
        </nav>

    </main>

    <!-- Floating particles animation - reduced for subtlety (2 particles, lower opacity) -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div class="absolute top-1/4 left-1/4 w-2 h-2 rounded-full animate-float" style="background: var(--color-primary); opacity: ${particleOpacity};"></div>
        <div class="absolute bottom-1/3 right-1/4 w-3 h-3 rounded-full animate-float-delayed" style="background: var(--color-secondary); opacity: ${particleOpacity};"></div>
    </div>

    <style>
        /* Subtle gradient shift animation instead of pulse */
        @keyframes gradient-shift {
            0%, 100% {
                background-position: 0% 50%;
                filter: brightness(1);
            }
            50% {
                background-position: 100% 50%;
                filter: brightness(1.1);
            }
        }

        .animate-gradient-shift {
            background-size: 200% 200%;
            animation: gradient-shift 4s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(180deg); }
        }

        @keyframes float-delayed {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(-180deg); }
        }

        .animate-float {
            animation: float 12s ease-in-out infinite;
            will-change: transform;
        }

        .animate-float-delayed {
            animation: float-delayed 12s ease-in-out infinite;
            will-change: transform;
        }
    </style>
</body>
</html>`;
}

async function generateStaticFiles() {
  try {
    // Get theme from config or use default
    const theme = await getTheme();

    // Create dist directory if it doesn't exist
    await mkdir("dist", { recursive: true });

    // Generate and write the 404.html file
    const html = generate404Html(theme);
    await writeFile("dist/404.html", html);

    console.log("[OK] Generated dist/404.html");
    console.log(`     Theme: ${theme.preset} (Catppuccin)`);
  } catch (error) {
    console.error("[FAIL] Error generating static files:", error);
    process.exit(1);
  }
}

// Run the generator
void generateStaticFiles();
