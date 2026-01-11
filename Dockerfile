# Multi-stage Dockerfile for DSLF (Link Shortener & LinkTree Page)
# Uses Chainguard's secure, minimal container images
#
# Build arguments:
#   REDIRECTS_FILE - Path to redirects CSV file (default: redirects.csv)
#   LINKTREE_FILE  - Path to link-index YAML file (default: link-index.yaml, optional)
#
# Examples:
#   docker build -t dslf .
#   docker build -t dslf --build-arg REDIRECTS_FILE=my-links.csv .
#   docker build -t dslf --build-arg LINKTREE_FILE=my-profile.yaml .

# =============================================================================
# Stage 1: Build static assets (CSS, HTML) with Bun
# =============================================================================
FROM cgr.dev/chainguard/wolfi-base:latest AS static

# Build arguments for config file paths
ARG REDIRECTS_FILE=redirects.csv
ARG LINKTREE_FILE=link-index.yaml

# Install Bun directly using the official install script
# (Chainguard's dedicated Bun image requires a paid subscription)
# libstdc++ is required by @parcel/watcher (tailwindcss dependency)
RUN apk add --no-cache bash curl unzip libstdc++ && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/bin/bun

WORKDIR /static

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files needed for build
COPY src ./src
COPY templates ./templates
COPY tailwind.config.js ./

# Copy config files - .example files are always present, user files may exist
# The ARG values allow custom paths to be specified at build time
COPY redirects.csv.example ${REDIRECTS_FILE}* ./
COPY link-index.yaml.example ${LINKTREE_FILE}* ./

# Normalize config file names and use example files as fallback
RUN if [ -f "${REDIRECTS_FILE}" ] && [ "${REDIRECTS_FILE}" != "redirects.csv" ]; then \
        mv "${REDIRECTS_FILE}" redirects.csv; \
    elif [ ! -f redirects.csv ]; then \
        cp redirects.csv.example redirects.csv; \
    fi && \
    if [ -f "${LINKTREE_FILE}" ] && [ "${LINKTREE_FILE}" != "link-index.yaml" ]; then \
        mv "${LINKTREE_FILE}" link-index.yaml; \
    elif [ ! -f link-index.yaml ]; then \
        cp link-index.yaml.example link-index.yaml; \
    fi

# Build static assets (CSS + HTML)
RUN bun run build

# =============================================================================
# Stage 2: Build Rust application
# =============================================================================
FROM cgr.dev/chainguard/rust:latest-dev AS build

# Create build directory with correct ownership for nonroot user
USER root
RUN mkdir -p /build && chown nonroot:nonroot /build
USER nonroot

WORKDIR /build

# Copy manifest files first for better layer caching
COPY --chown=nonroot:nonroot Cargo.toml Cargo.lock ./

# Copy source code
COPY --chown=nonroot:nonroot src ./src

# Build release binary (limit jobs for constrained environments)
RUN cargo build --release --locked -j 2

# =============================================================================
# Stage 3: Runtime image (minimal, secure)
# =============================================================================
FROM cgr.dev/chainguard/glibc-dynamic:latest

WORKDIR /app

# Copy binary
COPY --from=build --chown=nonroot:nonroot /build/target/release/dslf /app/dslf

# Copy static assets from the static build stage
COPY --from=static --chown=nonroot:nonroot /static/dist /app/static

# Copy redirects configuration from static stage (already has fallback applied)
COPY --from=static --chown=nonroot:nonroot /static/redirects.csv /app/

# Configuration via environment variables
ENV STATIC_DIR=/app/static \
    RUST_LOG=dslf=info

EXPOSE 3000

# Note: For health checks, configure your orchestrator to probe GET /health
# Example for Kubernetes:
#   livenessProbe:
#     httpGet:
#       path: /health
#       port: 3000

# Run with explicit config path (STATIC_DIR is picked up from env)
ENTRYPOINT ["/app/dslf", "--config", "/app/redirects.csv"]
