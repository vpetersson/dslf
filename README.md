# DSLF - Damn Small Link Forwarder

[![sbomified](https://sbomify.com/assets/images/logo/badge.svg)](https://app.sbomify.com/public/component/Tp1KWwHmzC1i)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A blazing fast, self-hosted link shortener and LinkTree-style page builder. Built with Rust for maximum performance and minimal resource usage.

**Why DSLF?** Replace bit.ly, TinyURL, and Linktree with a single, self-hosted service that's fast, private, and simple to configure.

## Quick Start

1. Create `redirects.csv` and optionally `link-index.yaml` (see [Configuration](#configuration))
2. Copy [`Dockerfile.user-example`](Dockerfile.user-example) to `Dockerfile`
3. Build and run:

```bash
docker build -t my-links .
docker run -p 3000:3000 my-links
```

Your links are live at `http://localhost:3000`.

## Features

| Feature            | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| **Blazing Fast**   | Sub-millisecond redirects, 50k+ req/sec on modest hardware        |
| **LinkTree Page**  | Beautiful landing page with Catppuccin theming                    |
| **Zero Database**  | Simple CSV/YAML config—no PostgreSQL, Redis, or external services |
| **Tiny Footprint** | 5MB binary, <10MB RAM, sub-second cold starts                     |
| **Privacy First**  | No tracking, no analytics, fully self-hosted                      |
| **SEO Optimized**  | Open Graph, Twitter Cards, JSON-LD structured data                |
| **Accessible**     | WCAG compliant with semantic HTML and ARIA labels                 |
| **Import Support** | Migrate from Rebrandly with one command                           |

## Configuration

| File              | Required | Runtime Mountable  | Description                        |
| ----------------- | -------- | ------------------ | ---------------------------------- |
| `redirects.csv`   | Yes      | ✅ Yes             | Your short link redirects          |
| `link-index.yaml` | No       | ❌ No (build-time) | LinkTree-style landing page config |

**Important:** The landing page is compiled at build time—rebuild to update it. Redirects can be mounted at runtime.

### Redirects (redirects.csv)

```csv
url,target,status

# Development
/gh,https://github.com/yourusername,301
/docs,https://docs.yourproject.com,301

# Marketing (302 for tracking)
/promo,https://yoursite.com/offer,302
```

- `url` — Short path (e.g., `/gh`)
- `target` — Destination URL
- `status` — `301` (permanent) or `302` (temporary)

Comments (`#`) and blank lines are supported.

### LinkTree Page (link-index.yaml)

Optional landing page at `/`. **Requires rebuild to update.**

```yaml
profile:
  name: "Your Name"
  bio: "Software Developer | Open Source Enthusiast"
  type: "person" # or "organization"
  avatar: "https://example.com/avatar.jpg" # optional

theme:
  preset: "mocha" # mocha | macchiato | frappe | latte
  buttonStyle: "glass" # glass | solid | outline

seo:
  site_url: "https://yourdomain.com" # enables sitemap.xml

social:
  github: "https://github.com/yourusername"
  linkedin: "https://linkedin.com/in/yourusername"

links:
  - title: "My Portfolio"
    url: "https://portfolio.example.com"
    icon: "fas fa-briefcase"
  - title: "Contact"
    url: "https://example.com/contact"
    highlight: true

footer:
  show_powered_by: true
```

- **Theme:** [Catppuccin](https://catppuccin.com/) palette (Mocha, Macchiato, Frappé, Latte)
- **Social:** GitHub, LinkedIn, Twitter/X, Instagram, YouTube, Discord, Mastodon, Bluesky, [and more](templates/index-utils.ts)
- **SEO:** Set `site_url` to generate `sitemap.xml` and `robots.txt`

## Deployment

### With Landing Page (Recommended)

Use the multi-stage build with the pre-built builder image:

```dockerfile
# Dockerfile
FROM vpetersson/dslf:builder AS static
COPY redirects.csv ./
COPY link-index.yaml ./
RUN bun run build

FROM vpetersson/dslf:latest
COPY --from=static /static/dist /app/static
COPY --from=static /static/redirects.csv /app/
```

```bash
docker build -t my-dslf .
docker run -p 3000:3000 my-dslf
```

**Docker Compose:**

```yaml
services:
  dslf:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
```

### Redirects Only

If you don't need a landing page, mount `redirects.csv` at runtime:

```bash
docker run -p 3000:3000 -v $(pwd)/redirects.csv:/app/redirects.csv vpetersson/dslf:latest
```

### Available Images

| Image                       | Description                            |
| --------------------------- | -------------------------------------- |
| `vpetersson/dslf:latest`    | Runtime image with default assets      |
| `vpetersson/dslf:builder`   | Builder image for custom builds        |
| `vpetersson/dslf:v1.2.0`    | Specific version                       |
| `ghcr.io/vpetersson/dslf:*` | Same tags on GitHub Container Registry |

## CLI Reference

```
dslf [OPTIONS] [COMMAND]

Options:
  -c, --config <FILE>    CSV file path [default: redirects.csv]
  -b, --bind <ADDR>      Bind address [default: 0.0.0.0]
  -p, --port <PORT>      Port [default: 3000]
  -m, --modern           Use 307/308 instead of 301/302
  -v, --validate         Validate destination URLs
  -k, --check            Check config syntax
  -s, --silent           Disable request logging
      --static-dir <DIR> Static files directory

Commands:
  import rebrandly       Import links from Rebrandly
```

## Development

```bash
git clone https://github.com/vpetersson/dslf.git && cd dslf
bun install && bun run build    # Frontend
cargo build --release           # Backend
cargo test && bun test          # Tests
```

### Release

```bash
git tag -a v1.x.0 -m "Release v1.x.0" && git push origin v1.x.0
```

## License

[Apache 2.0](LICENSE)
