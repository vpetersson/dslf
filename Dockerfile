FROM cgr.dev/chainguard/rust as build
WORKDIR /work

# Copy manifest files
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

RUN cargo build --release

FROM cgr.dev/chainguard/glibc-dynamic
COPY --from=build --chown=nonroot:nonroot /work/target/release/dslf /usr/local/bin/dslf

# Expose port
EXPOSE 3000

# Run the binary
ENTRYPOINT ["/usr/local/bin/dslf"]