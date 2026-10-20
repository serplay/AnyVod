# syntax=docker/dockerfile:1

# ---- Dependency planner (cargo-chef caches deps separately from app code) ----
FROM rust:1-slim-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ---- Build ----
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --locked --bin anyvod-backend

# ---- Runtime ----
FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=builder /app/target/release/anyvod-backend /usr/local/bin/anyvod-backend
ENV PORT=8000 \
    RUST_LOG=info
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/anyvod-backend", "--healthcheck"]
ENTRYPOINT ["/usr/local/bin/anyvod-backend"]
