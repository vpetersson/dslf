/**
 * Link Index page generator utilities
 * Uses Catppuccin color palette for theming
 * @see https://catppuccin.com/
 */

import type { Config, LinkConfig } from "./config/schema";
import { generateThemeCSS } from "./theme/generator";

// Re-export parser functions
export { parseConfig, validateConfig } from "./config/parser";
export type { Config } from "./config/schema";

// Social media icon mapping for FontAwesome
export const socialIcons: Record<string, string> = {
  twitter: "fab fa-twitter",
  x: "fab fa-x-twitter",
  linkedin: "fab fa-linkedin",
  github: "fab fa-github",
  instagram: "fab fa-instagram",
  youtube: "fab fa-youtube",
  facebook: "fab fa-facebook",
  discord: "fab fa-discord",
  telegram: "fab fa-telegram",
  email: "fas fa-envelope",
  website: "fas fa-globe",
  tiktok: "fab fa-tiktok",
  slack: "fab fa-slack",
  stackoverflow: "fab fa-stack-overflow",
  gitlab: "fab fa-gitlab",
  codepen: "fab fa-codepen",
  medium: "fab fa-medium",
  dev: "fab fa-dev",
  hashnode: "fas fa-hashtag",
  behance: "fab fa-behance",
  dribbble: "fab fa-dribbble",
  calendly: "fas fa-calendar-alt",
  twitch: "fab fa-twitch",
  spotify: "fab fa-spotify",
  mastodon: "fab fa-mastodon",
  bluesky: "fab fa-bluesky",
  threads: "fab fa-threads",
  reddit: "fab fa-reddit"
};

/**
 * Generate HTML for a social media link button
 */
export function generateSocialLink(platform: string, url: string): string {
  const icon = socialIcons[platform.toLowerCase()] ?? "fas fa-link";
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

  return `
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
       class="social-link group flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 hover:scale-110"
       aria-label="${platformName} profile">
      <i class="${icon} text-xl" aria-hidden="true"></i>
      <span class="sr-only">${platformName}</span>
    </a>
  `;
}

/**
 * Generate HTML for a custom link card
 */
export function generateCustomLink(link: LinkConfig): string {
  const icon = link.icon ?? "fas fa-external-link-alt";

  return `
    <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
       class="custom-link block w-full p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] group ${link.highlight ? "ring-2 ring-offset-2 ring-offset-transparent" : ""}"
       style="${link.highlight ? "ring-color: var(--color-primary);" : ""}"
       aria-label="${escapeHtml(link.title)} - Opens in new tab">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          ${link.icon ? `<i class="${icon} text-lg" aria-hidden="true"></i>` : ""}
          <div>
            <span class="font-medium">${escapeHtml(link.title)}</span>
            ${link.description ? `<p class="text-sm text-muted mt-0.5">${escapeHtml(link.description)}</p>` : ""}
          </div>
        </div>
        <i class="fas fa-arrow-right opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" aria-hidden="true"></i>
      </div>
    </a>
  `;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return text.replace(/[&<>"']/g, char => htmlEscapes[char] ?? char);
}

/**
 * Generate floating particles animation HTML
 */
function generateParticles(isLight: boolean): string {
  const opacity = isLight ? "0.15" : "0.3";
  return `
    <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div class="absolute top-1/4 left-1/4 w-2 h-2 rounded-full animate-float" style="background: var(--color-primary); opacity: ${opacity};"></div>
      <div class="absolute top-1/3 right-1/4 w-3 h-3 rounded-full animate-float-delayed" style="background: var(--color-secondary); opacity: ${opacity};"></div>
      <div class="absolute bottom-1/4 left-1/3 w-1 h-1 rounded-full animate-float" style="background: var(--color-primary); opacity: ${opacity};"></div>
      <div class="absolute bottom-1/3 right-1/3 w-2 h-2 rounded-full animate-float-delayed" style="background: var(--color-secondary); opacity: ${opacity};"></div>
    </div>
  `;
}

/**
 * Generate the complete index.html page
 */
export function generateIndexHtml(config: Config): string {
  const isLight = config.theme?.preset === "latte";
  const themeCSS = generateThemeCSS(config.theme);

  // Generate social links
  const socialLinks = config.social
    ? Object.entries(config.social)
        .filter(([_, url]) => url?.trim())
        .map(([platform, url]) => generateSocialLink(platform, url))
        .join("")
    : "";

  // Generate custom links (handles both array and converted record format)
  const customLinks = config.links
    ? config.links
        .filter(link => link.url?.trim())
        .map(link => generateCustomLink(link))
        .join("")
    : "";

  // Generate structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": config.profile.type === "organization" ? "Organization" : "Person",
    name: config.profile.name,
    description: config.profile.bio,
    ...(config.profile.avatar && { image: config.profile.avatar }),
    ...(config.social && {
      sameAs: Object.values(config.social).filter(url => url?.trim())
    })
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Primary Meta Tags -->
    <title>${escapeHtml(config.profile.name)} | Links</title>
    <meta name="title" content="${escapeHtml(config.profile.name)} | Links">
    <meta name="description" content="${escapeHtml(config.profile.bio)}">
    <meta name="author" content="${escapeHtml(config.profile.name)}">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="${config.theme?.preset === "latte" ? "#eff1f5" : "#1e1e2e"}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(config.profile.name)} | Links">
    <meta property="og:description" content="${escapeHtml(config.profile.bio)}">
    <meta property="og:site_name" content="${escapeHtml(config.profile.name)}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary">
    <meta property="twitter:title" content="${escapeHtml(config.profile.name)} | Links">
    <meta property="twitter:description" content="${escapeHtml(config.profile.bio)}">

    <!-- Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
    </script>

    <!-- Stylesheets -->
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="css/inter.css">
    <link rel="stylesheet" href="css/fontawesome.min.css">

    <!-- Theme: Catppuccin (https://catppuccin.com/) -->
    <style>
      ${themeCSS}

      /* Animations */
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(180deg); }
      }
      @keyframes float-delayed {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-30px) rotate(-180deg); }
      }

      .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
      .animate-delay-100 { animation-delay: 0.1s; opacity: 0; }
      .animate-delay-200 { animation-delay: 0.2s; opacity: 0; }
      .animate-delay-300 { animation-delay: 0.3s; opacity: 0; }
      .animate-float { animation: float 6s ease-in-out infinite; }
      .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <main class="w-full max-w-md mx-auto" role="main">
        <!-- Profile Section -->
        <header class="text-center mb-8 animate-fade-in-up">
            ${config.profile.avatar ? `<img src="${escapeHtml(config.profile.avatar)}" alt="${escapeHtml(config.profile.name)}" class="w-24 h-24 rounded-full mx-auto mb-4 border-2" style="border-color: var(--color-overlay);">` : ""}
            <h1 class="text-2xl font-bold mb-2">${escapeHtml(config.profile.name)}</h1>
            <p class="text-lg leading-relaxed text-muted">${escapeHtml(config.profile.bio)}</p>
        </header>

        ${
          socialLinks
            ? `
        <!-- Social Media Links -->
        <div class="mb-8 animate-fade-in-up animate-delay-100">
            <div class="flex flex-wrap justify-center gap-3">
                ${socialLinks}
            </div>
        </div>
        `
            : ""
        }

        ${
          customLinks
            ? `
        <!-- Custom Links -->
        <div class="space-y-4 animate-fade-in-up animate-delay-200">
            ${customLinks}
        </div>
        `
            : ""
        }

        ${
          config.footer?.show_powered_by !== false
            ? `
        <!-- Footer -->
        <footer class="text-center mt-12 animate-fade-in-up animate-delay-300" role="contentinfo">
            <a href="https://github.com/vpetersson/dslf" target="_blank" rel="noopener noreferrer"
               class="inline-flex items-center gap-3 p-3 rounded-lg transition-all duration-300 group"
               style="background: var(--color-surface); border: 1px solid var(--color-overlay);"
               aria-label="Built with DSLF - Star on GitHub">
                <div class="flex items-center gap-2">
                    <i class="fas fa-heart" style="color: var(--color-secondary);" aria-hidden="true"></i>
                    <span class="text-sm text-muted">Built with</span>
                    <span class="font-medium">DSLF</span>
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-star" style="color: var(--color-primary);" aria-hidden="true"></i>
                    <span class="text-sm">Star on</span>
                    <i class="fab fa-github text-lg" aria-hidden="true"></i>
                </div>
            </a>
            <p class="text-xs mt-2 text-muted">
                Open source link shortener & page builder
            </p>
        </footer>
        `
            : ""
        }
    </main>

    <!-- Floating particles animation -->
    ${generateParticles(isLight)}
</body>
</html>`;
}
