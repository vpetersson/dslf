# DSLF - Damn Small Link Forwarder

[![sbomified](https://sbomify.com/assets/images/logo/badge.svg)](https://app.sbomify.com/public/component/Tp1KWwHmzC1i)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A blazing fast, self-hosted link shortener and LinkTree-style page builder. Built with Rust for maximum performance and minimal resource usage.

**Why DSLF?** Replace bit.ly, TinyURL, and Linktree with a single, self-hosted service that's fast, private, and simple to configure.

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Configuration](#configuration)
  - [Redirects (redirects.csv)](#redirects-redirectscsv)
  - [LinkTree Page (link-index.yaml)](#linktree-page-link-indexyaml)
- [Deployment](#deployment)
  - [Docker](#docker)
  - [Docker Compose](#docker-compose)
  - [Kubernetes](#kubernetes)
  - [PaaS (Fly.io, Railway, Render)](#paas-flyio-railway-render)
- [CLI Reference](#cli-reference)
- [Development](#development)
- [License](#license)

## Quick Start

### Option 1: Fork & Deploy (Recommended)

1. **Fork this repository**
2. **Copy and customize configuration:**

   ```bash
   cp redirects.csv.example redirects.csv      # Required: your short links
   cp link-index.yaml.example link-index.yaml  # Optional: LinkTree page
   ```

3. **Deploy:**

   ```bash
   docker build -t my-links .
   docker run -p 3000:3000 my-links
   ```

> Your config files are gitignored—personal links stay private and won't conflict with upstream updates.

### Option 2: Use Pre-built Image

```bash
docker run -p 3000:3000 \
  -v $(pwd)/redirects.csv:/app/redirects.csv \
  vpetersson/dslf:latest
```

## Features

| Feature            | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| **Blazing Fast**   | Sub-millisecond redirects, 50k+ req/sec on modest hardware   |
| **LinkTree Page**  | Beautiful landing page with Catppuccin theming               |
| **Zero Database**  | Simple CSV config—no PostgreSQL, Redis, or external services |
| **Tiny Footprint** | 5MB binary, <10MB RAM, sub-second cold starts                |
| **Privacy First**  | No tracking, no analytics, fully self-hosted                 |
| **SEO Optimized**  | Open Graph, Twitter Cards, JSON-LD structured data           |
| **Accessible**     | WCAG compliant with semantic HTML and ARIA labels            |
| **Import Support** | Migrate from Rebrandly with one command                      |

## Configuration

| File              | Required | Description                        |
| ----------------- | -------- | ---------------------------------- |
| `redirects.csv`   | Yes      | Your short link redirects          |
| `link-index.yaml` | No       | LinkTree-style landing page config |

Both have `.example` templates. Copy and customize them—examples are tracked in git, your configs are gitignored.

### Redirects (redirects.csv)

```csv
url,target,status

# Development
/gh,https://github.com/yourusername,301
/docs,https://docs.yourproject.com,301

# Marketing (302 for tracking)
/promo,https://yoursite.com/offer,302
```

**Fields:**

- `url` — Short path (e.g., `/gh`)
- `target` — Destination URL
- `status` — `301` (permanent) or `302` (temporary)

> Comments (`#`) and blank lines are supported for organization.

### LinkTree Page (link-index.yaml)

Optional landing page at `/` with your profile, social links, and custom links.

```yaml
profile:
  name: "Your Name"
  bio: "Software Developer | Open Source Enthusiast"
  type: "person" # or "organization"
  avatar: "https://example.com/avatar.jpg" # optional

theme:
  preset: "mocha" # mocha | macchiato | frappe | latte (Catppuccin)
  buttonStyle: "glass" # glass | solid | outline

social:
  github: "https://github.com/yourusername"
  linkedin: "https://linkedin.com/in/yourusername"
  email: "mailto:you@example.com"

links:
  - title: "My Portfolio"
    url: "https://portfolio.example.com"
    icon: "fas fa-briefcase"
  - title: "Latest Blog Post"
    url: "https://blog.example.com/latest"
    highlight: true

footer:
  show_powered_by: true
```

**Supported social platforms:** LinkedIn, GitHub, GitLab, Twitter/X, Instagram, YouTube, TikTok, Discord, Telegram, Mastodon, Bluesky, and [more](templates/index-utils.ts).

**Theme:** Uses [Catppuccin](https://catppuccin.com/) color palette with 4 flavors (Mocha, Macchiato, Frappé, Latte).

## Deployment

### Docker

Three deployment options depending on your needs:

#### Option 1: Redirects Only (Simplest)

If you only need link redirects (no custom landing page):

```bash
docker run -p 3000:3000 \
  -v $(pwd)/redirects.csv:/app/redirects.csv \
  vpetersson/dslf:latest
```

#### Option 2: Custom Landing Page (Recommended)

Use the pre-built builder image for fast builds with your custom config:

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

> See [`Dockerfile.user-example`](Dockerfile.user-example) for a complete template.

#### Option 3: Full Build from Source

Build everything from scratch (slower, but complete control):

```bash
# Build with defaults
docker build -t dslf .

# Build with custom config paths
docker build -t dslf \
  --build-arg REDIRECTS_FILE=my-links.csv \
  --build-arg LINKTREE_FILE=my-profile.yaml .
```

**Available images:**

| Image                            | Description                                     |
| -------------------------------- | ----------------------------------------------- |
| `vpetersson/dslf:latest`         | Runtime image with default assets               |
| `vpetersson/dslf:builder`        | Builder image with Bun + deps for custom builds |
| `vpetersson/dslf:v1.2.0`         | Specific version (runtime)                      |
| `vpetersson/dslf:builder-v1.2.0` | Specific version (builder)                      |
| `ghcr.io/vpetersson/dslf:*`      | Same tags on GitHub Container Registry          |

### Docker Compose

```yaml
services:
  dslf:
    image: vpetersson/dslf:latest
    ports:
      - "3000:3000"
    volumes:
      - "./redirects.csv:/app/redirects.csv"
      - "./link-index.yaml:/app/link-index.yaml" # optional
    environment:
      - RUST_LOG=dslf=info
    restart: unless-stopped
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dslf
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dslf
  template:
    metadata:
      labels:
        app: dslf
    spec:
      containers:
        - name: dslf
          image: vpetersson/dslf:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
```

### PaaS (Fly.io, Railway, Render)

DSLF is ideal for PaaS due to its tiny footprint:

- **5MB binary** — Minimal resources
- **<10MB RAM** — Cost-effective instances
- **Sub-second cold starts** — Perfect for serverless

```bash
# Fly.io
fly deploy
```

## CLI Reference

```bash
dslf [OPTIONS] [COMMAND]

Options:
  -c, --config <FILE>    CSV file path [default: redirects.csv]
  -b, --bind <ADDR>      Bind address [default: 0.0.0.0] [env: DSLF_BIND_ADDR]
  -p, --port <PORT>      Port [default: 3000] [env: DSLF_PORT]
  -m, --modern           Use 307/308 instead of 301/302
  -v, --validate         Validate destination URLs before starting
  -k, --check            Check config syntax (no network requests)
  -s, --silent           Disable request logging
      --static-dir <DIR> Serve static files from directory [env: STATIC_DIR]
  -h, --help             Show help

Commands:
  import rebrandly       Import links from Rebrandly
```

**Examples:**

```bash
# Validate all destinations
dslf --validate

# Check syntax only (fast, no network)
dslf --check

# Custom port and config
dslf --port 8080 --config my-links.csv

# Import from Rebrandly
REBRANDLY_API_KEY=xxx dslf import rebrandly
```

## Development

### Prerequisites

- **Rust** (latest stable)
- **Bun** (for frontend assets)

### Setup

```bash
git clone https://github.com/vpetersson/dslf.git
cd dslf

# Install dependencies
bun install

# Build frontend assets
bun run build

# Build Rust binary
cargo build --release
```

### Testing

```bash
# All tests
cargo test && bun test

# Quality checks (lint, format, test)
bun run quality

# Coverage
cargo tarpaulin --out Html
```

### Creating a Release

```bash
./scripts/create-release.sh
```

The script validates, tests, builds, and creates a git tag that triggers CI/CD to build binaries and Docker images for all platforms.

## License

[Apache 2.0](LICENSE)

---

<p align="center">
  <sub>Built with ❤️ using Rust and TypeScript</sub>
</p>
