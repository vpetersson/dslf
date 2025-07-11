# DSLF - Damn Small Link Forwarder

A blazing fast, self-hosted alternative to bit.ly and similar link shortening services. Built with Rust for maximum performance and minimal resource usage.

## Why DSLF?

**Replace bit.ly, TinyURL, and other link shorteners with your own service:**

- 🚀 **Self-hosted**: Full control over your links and data
- ⚡ **Blazing fast**: Sub-millisecond response times
- 🔒 **Privacy-focused**: No tracking, no analytics unless you want them
- 💾 **Tiny footprint**: Single 5MB binary, minimal memory usage
- 📝 **Simple config**: Just a CSV file - no database required
- 🛡️ **Reliable**: No third-party dependencies for core functionality

## Features

- **Minimal codebase**: Single binary with minimal dependencies
- **Fast**: Built with Axum web framework for high performance
- **Simple configuration**: CSV-based redirect rules
- **HTTP compliant**: Supports 301 (permanent) and 302 (temporary) redirects
- **Well tested**: 70%+ test coverage with comprehensive error handling
- **URL validation**: Optional destination URL validation before deployment

## Usage

1. Create a CSV file named `redirects.csv` with your short links:
   ```csv
   url,target,status
   /gh,https://github.com/yourusername,301
   /blog,https://yourblog.com,301
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

- `--validate` or `-v`: Validate all destination URLs before starting (use in deployment/CI)
- `--config <file>` or `-c <file>`: Specify a custom CSV file path (default: redirects.csv)
- `--bind <address>` or `-b <address>`: Bind address (default: 0.0.0.0, env: DSLF_BIND_ADDR)
- `--port <port>` or `-p <port>`: Port to listen on (default: 3000, env: DSLF_PORT)
- `--help` or `-h`: Show help information

**Note**: The `--validate` option makes actual HTTP requests to check if destinations are reachable. Use this during deployment or in CI/CD pipelines, not during development testing.

### Examples

```bash
# Validate all destinations before starting
./target/release/dslf --validate

# Use a custom config file
./target/release/dslf --config custom-redirects.csv

# Bind to specific address and port
./target/release/dslf --bind 127.0.0.1 --port 8080

# Use environment variables
DSLF_BIND_ADDR=192.168.1.100 DSLF_PORT=9000 ./target/release/dslf

# Validate destinations in a custom config file
./target/release/dslf --validate --config custom-redirects.csv
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

**Note**: Use semantic versioning (e.g., `v1.0.0`, `v1.2.3`, `v2.0.0-beta.1`) for proper release management.

## CSV Format

- `url`: The short path (e.g., `/gh`, `/blog`, `/promo`)
- `target`: The full URL to redirect to (e.g., `https://github.com/yourusername`)
- `status`: HTTP status code (301 for permanent, 302 for temporary/tracking)

## Deployment

### Production Setup

1. **Get a domain**: Register a short domain (e.g., `yourdomain.co`, `yl.ink`)
2. **Deploy the binary**: Upload `target/release/dslf` to your server
3. **Configure reverse proxy**: Use nginx/Apache to proxy to port 3000
4. **Set up SSL**: Use Let's Encrypt for HTTPS
5. **Run as service**: Use systemd, Docker, or similar to keep it running

### Docker Deployment

**Build and run the container:**

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

# Validate URLs before starting
docker run --rm dslf /dslf --validate
```

**Multi-stage Dockerfile (56.8MB final image):**
- Architecture-independent build
- Distroless runtime for security and minimal size
- No shell or unnecessary tools in final image

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

## Testing

Run the test suite:
```bash
cargo test
```

Generate coverage report:
```bash
cargo tarpaulin --out Html --output-dir coverage
```

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