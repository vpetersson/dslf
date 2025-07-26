FROM oven/bun:latest AS static
WORKDIR /static

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy source files needed for build
COPY src ./src
COPY templates ./templates
COPY tailwind.config.js ./
# Copy link-index.yaml if it exists (for Link Index page generation)
COPY link-index.yaml* ./

# Build static assets
RUN bun run build

FROM cgr.dev/chainguard/rust AS build
WORKDIR /work

# Copy manifest files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

RUN cargo build --release

FROM cgr.dev/chainguard/glibc-dynamic
COPY --from=build --chown=nonroot:nonroot /work/target/release/dslf /usr/local/bin/dslf

# Copy static assets from the static build stage
COPY --from=static --chown=nonroot:nonroot /static/dist /var/www/static

# Expose port
EXPOSE 3000

# Run the binary
ENTRYPOINT ["/usr/local/bin/dslf"]
