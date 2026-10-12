use std::{
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddr, TcpStream},
    process::ExitCode,
    time::Duration,
};

use anyvod_backend::{AppState, Config, config::DEFAULT_PORT, router};
use tracing_subscriber::EnvFilter;

fn main() -> ExitCode {
    let _ = dotenvy::dotenv();

    if std::env::args().skip(1).any(|a| a == "--healthcheck") {
        return healthcheck();
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info")),
        )
        .init();

    let config = match Config::from_env() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("invalid configuration: {e}");
            return ExitCode::FAILURE;
        }
    };

    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(rt) => rt,
        Err(e) => {
            tracing::error!("failed to start tokio runtime: {e}");
            return ExitCode::FAILURE;
        }
    };

    match runtime.block_on(serve(config)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!("server error: {e}");
            ExitCode::FAILURE
        }
    }
}

async fn serve(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let addr = SocketAddr::from((Ipv4Addr::UNSPECIFIED, config.port));
    tracing::info!(environment = %config.environment, %addr, "starting AnyVod API");
    let state = AppState::new(config)?;
    let app = router(state);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    tracing::info!("shut down cleanly");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::warn!("failed to listen for ctrl-c: {e}");
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => {
                tracing::warn!("failed to listen for SIGTERM: {e}");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}

/// `anyvod-backend --healthcheck`: GET http://127.0.0.1:$PORT/health, exit 0 on HTTP 200.
/// Uses a raw blocking socket so it works in a distroless image without curl.
fn healthcheck() -> ExitCode {
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.trim().parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);
    match probe_health(port) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::FAILURE,
        Err(e) => {
            eprintln!("healthcheck failed: {e}");
            ExitCode::FAILURE
        }
    }
}

fn probe_health(port: u16) -> std::io::Result<bool> {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let timeout = Duration::from_secs(3);
    let mut stream = TcpStream::connect_timeout(&addr, timeout)?;
    stream.set_read_timeout(Some(timeout))?;
    stream.set_write_timeout(Some(timeout))?;
    stream.write_all(
        format!("GET /health HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n")
            .as_bytes(),
    )?;
    // HTTP/1.0 + `Connection: close`: the server closes after the (tiny) response.
    let mut buf = Vec::new();
    stream.take(4096).read_to_end(&mut buf)?;
    let response = String::from_utf8_lossy(&buf);
    let status_line = response.lines().next().unwrap_or_default();
    let ok = status_line
        .split_whitespace()
        .nth(1)
        .is_some_and(|code| code == "200");
    if !ok {
        eprintln!("healthcheck: unexpected response {status_line:?}");
    }
    Ok(ok)
}
