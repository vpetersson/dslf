# Build stage
FROM rust:1.88-slim AS builder

# Create app directory
WORKDIR /app

# Copy manifest files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

# Build release binary
RUN cargo build --release

# Runtime stage - use distroless for smallest secure image
FROM gcr.io/distroless/cc-debian12

# Copy the binary from builder stage
COPY --from=builder /app/target/release/dslf /dslf

# Copy the default config file
COPY redirects.csv /redirects.csv

# Expose port
EXPOSE 3000

# Run the binary
ENTRYPOINT ["/dslf"]