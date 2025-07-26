# DSLF - Damn Small Link Forwarder

A blazing fast, self-hosted alternative to bit.ly and similar link shortening services. Built with Rust for maximum performance and minimal resource usage.

## Why DSLF?

**Replace bit.ly, TinyURL, and other link shorteners with your own service:**

- **Self-hosted**: Full control over your links and data
- **Blazing fast**: Sub-millisecond response times
- **Privacy-focused**: No tracking, no analytics unless you want them
- **Tiny footprint**: Single 5MB binary, minimal memory usage
- **Simple config**: Just a CSV file - no database required
- **Reliable**: No third-party dependencies for core functionality

## Features

- **Minimal codebase**: Single binary with minimal dependencies
- **Fast**: Built with Axum web framework for high performance
- **Simple configuration**: CSV-based redirect rules
- **HTTP compliant**: Supports both classic (301/302) and modern (307/308) redirect codes
- **Flexible routing**: Handles trailing slashes automatically
- **Well tested**: 70%+ test coverage with comprehensive error handling
- **URL validation**: Optional destination URL validation before deployment
- **Import capability**: Import links from external providers (Rebrandly supported)

## Usage

1. Create a CSV file named `redirects.csv` with your short links:

   ```csv
   url,target,status

   # GitHub and development links
   /gh,https://github.com/yourusername,301
   /blog,https://yourblog.com,301

   # Marketing and promotional links
   /promo,https://yoursite.com/special-offer,302
   /docs,https://docs.yourproject.com,301
   ```

2. Run the service:

   ```bash
   cargo run --release
   # or use the binary directly
   ./target/release/dslf
   ```

3. The service will start on `http://127.0.0.1:3000`

4. Your short links are now live:
   - `http://yourdomain.com/gh` → `https://github.com/yourusername`
   - `http://yourdomain.com/blog` → `https://yourblog.com`
   - `http://yourdomain.com/promo` → `https://yoursite.com/special-offer`

## Command Line Options

### Main Options

- `--validate` or `-v`: Validate all destination URLs before starting (use in deployment/CI)
- `--check` or `-k`: Check configuration file syntax without validating destinations
- `--config <file>` or `-c <file>`: Specify a custom CSV file path (default: redirects.csv)
- `--bind <address>` or `-b <address>`: Bind address (default: 0.0.0.0, env: DSLF_BIND_ADDR)
- `--port <port>` or `-p <port>`: Port to listen on (default: 3000, env: DSLF_PORT)
- `--modern` or `-m`: Use modern HTTP redirect codes (307/308) instead of classic ones (301/302)
- `--help` or `-h`: Show help information

**Note**: The `--validate` option makes actual HTTP requests to check if destinations are reachable. Use this during deployment or in CI/CD pipelines, not during development testing. The `--check` option only validates the CSV file format and syntax without making any network requests, making it ideal for quick configuration validation during development or as a fast pre-flight check before deployment.

### Import Command

DSLF can import links from external URL shortening services and convert them to the standard CSV format:

```bash
# Import from Rebrandly
REBRANDLY_API_KEY=your_api_key_here dslf import rebrandly

# Import to custom output file
REBRANDLY_API_KEY=your_api_key_here dslf import rebrandly --output my-links.csv

# Alternative environment variable name
REBRANDLY_TOKEN=your_api_key_here dslf import rebrandly
```

**Supported providers:**

- **Rebrandly**: Imports all active links from your Rebrandly account

**Environment Variables:**

- `REBRANDLY_API_KEY` or `REBRANDLY_TOKEN`: Your Rebrandly API key

The import command handles pagination automatically and will fetch all your links regardless of quantity. Links are converted to the DSLF format with permanent redirects (301) by default.

### Examples

```bash
# Validate all destinations before starting
./target/release/dslf --validate

# Check configuration file syntax without network requests
./target/release/dslf --check

# Check a custom configuration file
./target/release/dslf --check --config custom-redirects.csv

# Use a custom config file
./target/release/dslf --config custom-redirects.csv

# Bind to specific address and port
./target/release/dslf --bind 127.0.0.1 --port 8080

# Use environment variables
DSLF_BIND_ADDR=192.168.1.100 DSLF_PORT=9000 ./target/release/dslf

# Use modern HTTP redirect codes (307/308 instead of 301/302)
./target/release/dslf --modern

# Validate destinations in a custom config file
./target/release/dslf --validate --config custom-redirects.csv

# Import links from Rebrandly
REBRANDLY_API_KEY=your_api_key ./target/release/dslf import rebrandly

# Import from Rebrandly to custom output file
REBRANDLY_API_KEY=your_api_key ./target/release/dslf import rebrandly --output rebrandly-links.csv
```

## Binary Distribution

### Local Build

The optimized binary is available at: `target/release/dslf`

### GitHub Releases

Pre-built binaries for multiple platforms are available on the [Releases page](../../releases):

- **Linux x86_64**: `dslf-vX.Y.Z-x86_64-unknown-linux-gnu.tar.gz`
- **Linux x86_64 (static)**: `dslf-vX.Y.Z-x86_64-unknown-linux-musl.tar.gz`
- **macOS Intel**: `dslf-vX.Y.Z-x86_64-apple-darwin.tar.gz`
- **macOS Apple Silicon**: `dslf-vX.Y.Z-aarch64-apple-darwin.tar.gz`
- **Windows x86_64**: `dslf-vX.Y.Z-x86_64-pc-windows-gnu.zip`

### Creating a Release

**Using the helper script (recommended):**

```bash
./scripts/create-release.sh
```

The release script provides an interactive experience that:

- **Validates environment**: Ensures you're in a git repository with no uncommitted changes
- **Suggests versions**: Automatically calculates next patch/minor/major versions based on existing tags
- **Runs quality checks**: Executes tests and builds the release binary to ensure everything works
- **Creates and pushes tags**: Handles git tagging and pushing to trigger the CI/CD pipeline

**Script workflow:**

1. Checks git status and current branch
2. Parses latest tag to suggest next semantic version
3. Allows you to choose: patch (v1.0.1), minor (v1.1.0), major (v2.0.0), or custom version
4. Runs `cargo test` to ensure all tests pass
5. Builds `cargo build --release` to verify the binary compiles
6. Tests the binary execution with `--help` flag
7. Creates annotated git tag and pushes to origin
8. Displays links to monitor the CI/CD pipeline

**Prerequisites:**

- Clean git working directory (no uncommitted changes)
- All tests must pass
- Binary must build successfully

**Example session:**

```bash
$ ./scripts/create-release.sh
[INFO] Latest tag: v0.1.0
Suggested next versions:
  1) Patch release: v0.1.1
  2) Minor release: v0.2.0
  3) Major release: v1.0.0
  4) Custom version
Choose an option (1-4): 2
[INFO] Creating release: v0.2.0
[INFO] Running tests...
[INFO] Building release binary...
[INFO] Testing binary...
[INFO] All checks passed!
This will:
  - Create and push tag: v0.2.0
  - Trigger CI/CD pipeline to build and publish release
Continue? (y/N): y
[INFO] Release v0.2.0 created successfully!
[INFO] CI/CD pipeline will now build and publish the release
```

**Manual release:**

```bash
# Tag a new version
git tag v1.0.0
git push origin v1.0.0
```

The CI/CD pipeline will automatically:

1. Build binaries for all supported platforms
2. Create a GitHub release
3. Upload all platform binaries as release assets
4. Build and publish multi-platform Docker images (linux/amd64, linux/arm64) to Docker Hub and GitHub Container Registry

**Note**: Use semantic versioning (e.g., `v1.0.0`, `v1.2.3`, `v2.0.0-beta.1`) for proper release management.

## CSV Format

- `url`: The short path (e.g., `/gh`, `/blog`, `/promo`)
- `target`: The full URL to redirect to (e.g., `https://github.com/yourusername`)
- `status`: HTTP status code (301 for permanent, 302 for temporary/tracking)

### Comments and Whitespace

DSLF supports both comments and whitespace lines for better organization:

**Comments**: Full-line comments using `#`
**Whitespace**: Empty lines or lines with only whitespace (spaces, tabs)

```csv
url,target,status

# GitHub and development links
/gh,https://github.com/yourusername,301
/blog,https://yourblog.com,301

# Marketing and promotional links
/promo,https://yoursite.com/special-offer,302

# Documentation
/docs,https://docs.yourproject.com,301
```

- **Full-line comments**: Lines starting with `#` (after optional whitespace) are ignored
- **Empty lines**: Completely blank lines are ignored
- **Whitespace lines**: Lines containing only spaces or tabs are ignored
- **Organizational**: Use comments and whitespace to group related redirects and improve readability
- **Flexible placement**: Comments and whitespace can appear anywhere between data rows

> **⚠️ Spreadsheet Warning**: Opening CSV files in spreadsheet applications (Excel, Google Sheets, etc.) will likely remove all comments and empty lines, losing the organizational structure. Edit the CSV file with a text editor to preserve these features.

### HTTP Redirect Codes

By default, DSLF uses classic HTTP redirect codes:

- **301**: Moved Permanently (classic permanent redirect)
- **302**: Found (classic temporary redirect)

With the `--modern` flag, DSLF uses modern HTTP redirect codes:

- **308**: Permanent Redirect (modern permanent redirect, preserves request method)
- **307**: Temporary Redirect (modern temporary redirect, preserves request method)

**When to use modern codes**: The modern codes (307/308) are more semantically correct as they guarantee the request method (GET, POST, etc.) won't change during redirection. Use `--modern` if your clients rely on specific HTTP methods being preserved.

## Deployment

### Production Setup

1. **Get a domain**: Register a short domain (e.g., `yourdomain.co`, `yl.ink`)
2. **Deploy the binary**: Upload `target/release/dslf` to your server
3. **Configure reverse proxy**: Use nginx/Apache to proxy to port 3000
4. **Set up SSL**: Use Let's Encrypt for HTTPS
5. **Run as service**: Use systemd, Docker, or similar to keep it running

### Platform-as-a-Service Deployment

DSLF is **ideal for modern PaaS platforms** like Fly.io, Railway, Render, and similar services due to its:

- **Tiny footprint**: 5MB binary uses minimal resources and starts instantly
- **No database required**: CSV-based configuration eliminates infrastructure complexity
- **Low memory usage**: Typically runs in <10MB RAM, perfect for cost-effective deployments
- **Fast cold starts**: Sub-second startup times ideal for serverless-style deployments
- **Single binary**: No dependencies or build steps required on the platform

**Example Fly.io deployment:**

```bash
# Deploy with a simple fly.toml
fly deploy
```

The minimal resource requirements mean you can run DSLF on the smallest available instances while still handling thousands of redirects per second, making it extremely cost-effective for personal and small business use cases.

### Deployment Patterns

**Custom Docker Image (Recommended for production):**

```dockerfile
FROM vpetersson/dslf:latest
COPY production-redirects.csv /redirects.csv
```

**Kubernetes Deployment:**

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
          image: your-registry/dslf:v1.0
          ports:
            - containerPort: 3000
          env:
            - name: DSLF_BIND_ADDR
              value: "0.0.0.0"
            - name: DSLF_PORT
              value: "3000"
```

### Docker Deployment

**Using pre-built images:**

```bash
# From Docker Hub - latest version
docker run -p 3000:3000 -v $(pwd)/redirects.csv:/redirects.csv vpetersson/dslf

# From Docker Hub - specific version
docker run -p 3000:3000 -v $(pwd)/redirects.csv:/redirects.csv vpetersson/dslf:v1.0.0

# From GitHub Container Registry - latest version
docker run -p 3000:3000 -v $(pwd)/redirects.csv:/redirects.csv ghcr.io/mvip/dslf

# From GitHub Container Registry - specific version
docker run -p 3000:3000 -v $(pwd)/redirects.csv:/redirects.csv ghcr.io/mvip/dslf:v1.0.0

# With custom configuration
docker run -p 8080:8080 -e DSLF_PORT=8080 -v ./my-redirects.csv:/redirects.csv vpetersson/dslf

# Validate URLs before starting
docker run --rm -v $(pwd)/redirects.csv:/redirects.csv vpetersson/dslf /dslf --validate

# Check configuration file syntax without network requests
docker run --rm -v $(pwd)/redirects.csv:/redirects.csv vpetersson/dslf /dslf --check
```

> **Note**: Docker images are built for multiple platforms (`linux/amd64`, `linux/arm64`) so they'll run natively on both Intel/AMD and ARM-based systems (including Apple Silicon Macs) without platform warnings.

**Build and run locally:**

```bash
# Build the image
docker build -t dslf .

# Run with default config (port 3000)
docker run -p 3000:3000 dslf

# Run on different port using environment variables
docker run -p 8080:8080 -e DSLF_PORT=8080 dslf

# Run with custom config and port
docker run -p 9000:9000 -e DSLF_PORT=9000 -v ./my-redirects.csv:/redirects.csv dslf

# Run with CLI arguments
docker run -p 8080:8080 dslf /dslf --port 8080 --config /redirects.csv

# Use modern HTTP redirect codes
docker run -p 3000:3000 dslf /dslf --modern

# Validate URLs before starting
docker run --rm dslf /dslf --validate
```

**Creating your own custom image:**

```dockerfile
# Dockerfile
FROM vpetersson/dslf:latest
COPY my-redirects.csv /redirects.csv
```

```bash
# Build and run your custom image
docker build -t my-link-shortener .
docker run -p 3000:3000 my-link-shortener

# Or push to your own registry
docker tag my-link-shortener yourregistry/my-link-shortener:v1.0
docker push yourregistry/my-link-shortener:v1.0
```

**Docker Compose:**

```yaml
version: "3.8"
services:
  dslf:
    image: vpetersson/dslf:latest # or ghcr.io/mvip/dslf:latest
    ports:
      - "3000:3000"
    volumes:
      - "./redirects.csv:/redirects.csv"
    environment:
      - DSLF_BIND_ADDR=0.0.0.0
      - DSLF_PORT=3000
    restart: unless-stopped
```

**Multi-stage Dockerfile (56.8MB final image):**

- Architecture-independent build
- Distroless runtime for security and minimal size
- No shell or unnecessary tools in final image
- Automatically published to Docker Hub and GitHub Container Registry
- **Multi-platform support**: Available for both `linux/amd64` and `linux/arm64` architectures

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.co;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Development

### Testing

Run the test suite:

```bash
cargo test
```

Generate coverage report:

```bash
cargo tarpaulin --out Html --output-dir coverage
```

### Release Management

The project includes a comprehensive release script at `scripts/create-release.sh` that automates the entire release process:

```bash
# Make script executable (first time only)
chmod +x scripts/create-release.sh

# Create a new release
./scripts/create-release.sh
```

The script handles:

- **Version management**: Suggests next semantic version based on existing tags
- **Quality assurance**: Runs tests and builds to ensure release readiness
- **Git operations**: Creates properly formatted tags and pushes to trigger CI/CD
- **Documentation**: Provides clear feedback and links to monitor the release process

### Code Quality

The project maintains high code quality standards:

- **Formatting**: `cargo fmt --all` (enforced in CI)
- **Linting**: `cargo clippy --all-targets --all-features -- -D warnings` (enforced in CI)
- **Testing**: 70%+ test coverage with comprehensive unit and integration tests
- **Documentation**: Inline code documentation and comprehensive README

### CI/CD Optimizations

The GitHub Actions workflow includes several optimizations for faster builds:

- **Rust caching**: Uses built-in `actions/cache` to cache dependencies, registry, and target directories
- **Parallel execution**: Test and Docker jobs run in parallel
- **Optimized Docker builds**: Single build per workflow run with conditional multi-platform support
- **Smart conditionals**: Multi-platform builds and pushes only occur on push events, single-platform builds for testing on PRs

## Performance

**Why DSLF outperforms traditional link shorteners:**

- **Sub-millisecond response times**: Built with Axum and Tokio for maximum performance
- **Minimal memory usage**: Entire ruleset loaded into memory for instant lookups
- **No database overhead**: CSV-based configuration eliminates database latency
- **Tiny binary size**: 5MB binary vs. complex web applications
- **Zero external dependencies**: No Redis, PostgreSQL, or other services required

**Benchmarks**: On a modest VPS, DSLF handles 50,000+ redirects per second with <1ms latency.

## Use Cases

- **Personal/Team link shortener**: Replace bit.ly for your organization
- **Campaign tracking**: Use 302 redirects for marketing campaigns
- **Vanity URLs**: Create memorable short links for your brand
- **API endpoints**: Redirect to versioned APIs with easy config updates
- **A/B testing**: Easily switch destinations by updating the CSV
- **Event links**: Temporary redirects for conferences, webinars, etc.
- **Custom Docker images**: Bake your redirects into a custom image for easy deployment
- **Microservice architecture**: Deploy as a lightweight redirect service in your stack
