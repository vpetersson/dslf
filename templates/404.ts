#!/usr/bin/env bun

/**
 * 404 Page Generator
 * Uses Catppuccin Mocha theme for consistency with the main site
 * @see https://catppuccin.com/
 */

import { mkdir, writeFile } from "fs/promises";

// Catppuccin Mocha colors for 404 page
const theme = {
  primary: "#cba6f7", // Mauve
  secondary: "#f5c2e7", // Pink
  background: "#1e1e2e", // Base
  surface: "#313244", // Surface0
  text: "#cdd6f4", // Text
  textMuted: "#a6adc8", // Subtext0
  overlay: "#45475a" // Surface1
};

const html404 = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

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

    <!-- Catppuccin Mocha Theme (https://catppuccin.com/) -->
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
            color: ${theme.background};
        }
        .btn-primary:hover {
            filter: brightness(1.1);
            box-shadow: 0 8px 25px rgba(203, 166, 247, 0.3);
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <main class="glass-effect rounded-2xl p-8 md:p-12 max-w-2xl w-full text-center shadow-2xl" role="main">
        <!-- Error Status -->
        <header class="mb-8">
            <h1 class="text-8xl md:text-9xl font-bold gradient-text animate-pulse" aria-label="Error 404">
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
            <a href="/" class="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-300 font-medium">
                <i class="fas fa-home" aria-hidden="true"></i>
                <span>Return Home</span>
            </a>
        </nav>

    </main>

    <!-- Floating particles animation using theme colors -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div class="absolute top-1/4 left-1/4 w-2 h-2 rounded-full animate-float" style="background: var(--color-primary); opacity: 0.3;"></div>
        <div class="absolute top-1/3 right-1/4 w-3 h-3 rounded-full animate-float-delayed" style="background: var(--color-secondary); opacity: 0.2;"></div>
        <div class="absolute bottom-1/4 left-1/3 w-1 h-1 rounded-full animate-float" style="background: var(--color-primary); opacity: 0.4;"></div>
        <div class="absolute bottom-1/3 right-1/3 w-2 h-2 rounded-full animate-float-delayed" style="background: var(--color-secondary); opacity: 0.3;"></div>
    </div>

    <style>
        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
        }

        @keyframes float-delayed {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-30px) rotate(-180deg); }
        }

        .animate-float {
            animation: float 6s ease-in-out infinite;
        }

        .animate-float-delayed {
            animation: float-delayed 8s ease-in-out infinite;
        }
    </style>
</body>
</html>`;

async function generateStaticFiles() {
  try {
    // Create dist directory if it doesn't exist
    await mkdir("dist", { recursive: true });

    // Write the 404.html file
    await writeFile("dist/404.html", html404);

    console.log("[OK] Generated dist/404.html");
  } catch (error) {
    console.error("[FAIL] Error generating static files:", error);
    process.exit(1);
  }
}

// Run the generator
void generateStaticFiles();
