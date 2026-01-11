# Builder image for DSLF
# Contains Bun and all npm dependencies pre-installed for fast user builds
#
# Usage in user's Dockerfile:
#   FROM vpetersson/dslf:builder AS static
#   COPY link-index.yaml ./
#   COPY redirects.csv ./
#   RUN bun run build
#
#   FROM vpetersson/dslf:latest
#   COPY --from=static /static/dist /app/static
#   COPY --from=static /static/redirects.csv /app/

FROM cgr.dev/chainguard/wolfi-base:latest

# Install Bun and required dependencies
# libstdc++ is required by @parcel/watcher (tailwindcss dependency)
RUN apk add --no-cache bash curl unzip libstdc++ && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/bin/bun

WORKDIR /static

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source files needed for build
COPY src/styles.css ./src/
COPY templates ./templates
COPY tailwind.config.js ./

# Copy example config files as defaults
COPY redirects.csv.example ./redirects.csv
COPY link-index.yaml.example ./link-index.yaml

# Default command shows usage
CMD ["echo", "Usage: COPY your config files and run 'bun run build'"]
