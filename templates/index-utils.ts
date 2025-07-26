// Social media icon mapping for FontAwesome
export const socialIcons: Record<string, string> = {
  twitter: "fab fa-twitter",
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
  calendly: "fas fa-calendar-alt"
};

export interface ProfileConfig {
  name: string;
  bio: string;
  background?: string;
  type?: "person" | "organization";
}

export interface FooterConfig {
  show_powered_by?: boolean;
}

export interface LinksConfig {
  profile: ProfileConfig;
  social?: Record<string, string>;
  links?: Record<string, string>;
  footer?: FooterConfig;
}

export function parseYaml(content: string): LinksConfig {
  // Simple YAML parser for our specific structure
  const lines = content.split("\n");
  const config: LinksConfig = { profile: { name: "", bio: "" } };
  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed.endsWith(":") && !trimmed.includes('"')) {
      const section = trimmed.slice(0, -1);
      if (["profile", "social", "links", "footer"].includes(section)) {
        currentSection = section;
        if (section === "social") {
          config.social = {};
        }
        if (section === "links") {
          config.links = {};
        }
        if (section === "footer") {
          config.footer = {};
        }
      }
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Remove quotes and comments
    value = value.replace(/^["']|["'].*$/g, "").trim();
    if (value.includes("#")) {
      value = value.split("#")[0].trim();
    }

    // Skip empty values
    if (!value) {
      continue;
    }

    if (currentSection === "profile") {
      // Skip avatar field since we removed it
      if (key !== "avatar") {
        if (key === "name") {
          config.profile.name = value;
        } else if (key === "bio") {
          config.profile.bio = value;
        } else if (key === "background") {
          config.profile.background = value;
        } else if (key === "type") {
          config.profile.type = value as "person" | "organization";
        }
      }
    } else if (currentSection === "social" && config.social) {
      config.social[key] = value;
    } else if (currentSection === "links" && config.links) {
      config.links[key.replace(/^["']|["']$/g, "")] = value;
    } else if (currentSection === "footer" && config.footer) {
      if (key === "show_powered_by") {
        config.footer.show_powered_by = value.toLowerCase() === "true";
      }
    }
  }

  return config;
}

export function generateSocialLink(platform: string, url: string): string {
  const icon = socialIcons[platform] ?? "fas fa-link";
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       class="social-link group flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:scale-110 transition-all duration-300 hover:shadow-lg"
       aria-label="${platformName} profile">
      <i class="${icon} text-xl text-white group-hover:text-white/90" aria-hidden="true"></i>
      <span class="sr-only">${platformName}</span>
    </a>
  `;
}

export function generateCustomLink(title: string, url: string): string {
  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer"
       class="custom-link block w-full p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:scale-[1.02] transition-all duration-300 group"
       aria-label="${title} - Opens in new tab">
      <div class="flex items-center justify-between">
        <span class="text-white font-medium group-hover:text-white/90">${title}</span>
        <i class="fas fa-external-link-alt text-white/60 group-hover:text-white/80 transition-colors" aria-hidden="true"></i>
      </div>
    </a>
  `;
}

export function generateIndexHtml(config: LinksConfig): string {
  const socialLinks = config.social
    ? Object.entries(config.social)
        .filter(([_, url]) => url?.trim())
        .map(([platform, url]) => generateSocialLink(platform, url))
        .join("")
    : "";

  const customLinks = config.links
    ? Object.entries(config.links)
        .filter(([_, url]) => url?.trim())
        .map(([title, url]) => generateCustomLink(title, url))
        .join("")
    : "";

  const backgroundStyle = config.profile.background
    ? `background-image: url('${config.profile.background}'); background-size: cover; background-position: center;`
    : "";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": config.profile.type === "organization" ? "Organization" : "Person",
    name: config.profile.name,
    description: config.profile.bio,
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
    <title>${config.profile.name} | Links</title>
    <meta name="title" content="${config.profile.name} | Links">
    <meta name="description" content="${config.profile.bio}">
    <meta name="author" content="${config.profile.name}">
        <meta name="robots" content="index, follow">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="">
    <meta property="og:title" content="${config.profile.name} | Links">
    <meta property="og:description" content="${config.profile.bio}">
    <meta property="og:site_name" content="${config.profile.name}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary">
    <meta property="twitter:url" content="">
    <meta property="twitter:title" content="${config.profile.name} | Links">
    <meta property="twitter:description" content="${config.profile.bio}">

    <!-- Structured Data -->
    <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
    </script>

    <!-- Stylesheets -->
    <link rel="stylesheet" href="styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            ${backgroundStyle}
        }
        .social-link:hover {
            box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
        }
        .custom-link:hover {
            box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
        }
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-delay-100 { animation-delay: 0.1s; }
        .animate-delay-200 { animation-delay: 0.2s; }
        .animate-delay-300 { animation-delay: 0.3s; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <main class="w-full max-w-md mx-auto" role="main">
        <!-- Profile Section -->
        <header class="text-center mb-8 animate-fade-in-up">
            <h1 class="text-2xl font-bold text-white mb-2">${config.profile.name}</h1>
            <p class="text-gray-300 text-lg leading-relaxed">${config.profile.bio}</p>
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
               class="inline-flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 group"
               aria-label="Built with DSLF - Star on GitHub">
                <div class="flex items-center gap-2">
                    <i class="fas fa-heart text-red-400 animate-pulse" aria-hidden="true"></i>
                    <span class="text-gray-400 text-sm">Built with</span>
                    <span class="text-gray-300 font-medium group-hover:text-white">DSLF</span>
                </div>
                <div class="flex items-center gap-2 text-gray-300 group-hover:text-white">
                    <i class="fas fa-star text-yellow-400 group-hover:scale-110 transition-transform" aria-hidden="true"></i>
                    <span class="text-sm">Star on</span>
                    <i class="fab fa-github text-lg group-hover:scale-110 transition-transform" aria-hidden="true"></i>
                </div>
            </a>
            <p class="text-gray-500 text-xs mt-2">
                Open source link shortener & page builder
            </p>
        </footer>
        `
                            : ""
                        }
    </main>

    <!-- Floating particles animation -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
        <div class="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400/30 rounded-full animate-float"></div>
        <div class="absolute top-1/3 right-1/4 w-3 h-3 bg-purple-400/20 rounded-full animate-float-delayed"></div>
        <div class="absolute bottom-1/4 left-1/3 w-1 h-1 bg-pink-400/40 rounded-full animate-float"></div>
        <div class="absolute bottom-1/3 right-1/3 w-2 h-2 bg-blue-300/30 rounded-full animate-float-delayed"></div>
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
}

export function validateConfig(config: LinksConfig): boolean {
  return !!(config.profile.name && config.profile.bio);
}
