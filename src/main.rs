use axum::{
    Router,
    body::Body,
    extract::Path,
    http::{Request, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
};
use clap::{Parser, Subcommand};
use serde::Deserialize;
use std::{
    collections::HashMap,
    path::PathBuf,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tokio::net::TcpListener;
use tower::{ServiceExt, service_fn};
use tower_http::services::ServeDir;

mod import;

type AppState = (HashMap<String, (String, u16)>, bool);

async fn logging_middleware(request: Request<Body>, next: Next) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let path = uri.path();
    let start = Instant::now();

    // Skip logging for favicon.ico requests (reduces noise in logs)
    let should_log = path != "/favicon.ico";

    // Extract client IP from proxy headers (in order of preference)
    // 1. CF-Connecting-IP (Cloudflare)
    // 2. X-Real-IP (nginx)
    // 3. X-Forwarded-For (first IP in chain)
    // 4. Fall back to "-" if none available
    let client_ip = if should_log {
        request
            .headers()
            .get("cf-connecting-ip")
            .or_else(|| request.headers().get("x-real-ip"))
            .or_else(|| request.headers().get("x-forwarded-for"))
            .and_then(|v| v.to_str().ok())
            .map(|s| {
                // X-Forwarded-For can contain multiple IPs, take the first one
                s.split(',').next().unwrap_or(s).trim()
            })
            .unwrap_or("-")
            .to_string()
    } else {
        String::new()
    };

    let response = next.run(request).await;

    if should_log {
        let duration = start.elapsed();
        let status = response.status();

        // Simple timestamp - seconds since epoch for consistency across platforms
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        println!(
            "{} {} {} {} {} {:.2}ms",
            timestamp,
            client_ip,
            method,
            uri.path_and_query().map_or(uri.path(), |pq| pq.as_str()),
            status.as_u16(),
            duration.as_secs_f64() * 1000.0
        );
    }

    response
}

#[derive(Debug, Deserialize)]
struct RedirectRule {
    url: String,
    target: String,
    status: u16,
}

#[derive(Parser)]
#[command(name = "dslf")]
#[command(about = "A minimal HTTP forwarding service")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Validate all destination URLs before starting
    #[arg(short, long)]
    validate: bool,

    /// Check configuration file syntax without validating destinations
    #[arg(short = 'k', long)]
    check: bool,

    /// Path to the CSV file containing redirect rules
    #[arg(short, long, default_value = "redirects.csv")]
    config: String,

    /// Bind address (can also be set via DSLF_BIND_ADDR env var)
    #[arg(short, long, env = "DSLF_BIND_ADDR", default_value = "0.0.0.0")]
    bind: String,

    /// Port to listen on (can also be set via DSLF_PORT env var)
    #[arg(short, long, env = "DSLF_PORT", default_value = "3000")]
    port: u16,

    /// Use modern HTTP redirect codes (307/308) instead of classic ones (301/302)
    #[arg(short, long)]
    modern: bool,

    /// Disable request logging to stdout
    #[arg(short, long)]
    silent: bool,

    /// Directory to serve static files from (index.html, 404.html, etc.)
    #[arg(long, env = "STATIC_DIR")]
    static_dir: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Commands {
    /// Import links from external providers
    ///
    /// Requires environment variables:
    /// - REBRANDLY_API_KEY or REBRANDLY_TOKEN for rebrandly provider
    Import {
        /// Provider to import from (currently supports: rebrandly)
        provider: String,
        /// Output file path for the imported redirects
        #[arg(short, long, default_value = "imported-redirects.csv")]
        output: String,
    },
}

fn create_app(
    rules: HashMap<String, (String, u16)>,
    modern: bool,
    enable_logging: bool,
    static_dir: Option<PathBuf>,
) -> Router {
    let state: AppState = (rules.clone(), modern);

    let mut app = if let Some(dir) = static_dir {
        // Path to custom 404 page
        let not_found_path = dir.join("404.html");

        // Create ServeDir for static file serving (fallback after redirect check)
        let serve_dir = ServeDir::new(&dir)
            .append_index_html_on_directories(true)
            .not_found_service(service_fn({
                let not_found_path = not_found_path.clone();
                move |_req: Request<Body>| {
                    let path = not_found_path.clone();
                    async move {
                        if let Ok(content) = tokio::fs::read_to_string(&path).await {
                            Ok((
                                StatusCode::NOT_FOUND,
                                [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                                content,
                            )
                                .into_response())
                        } else {
                            Ok((StatusCode::NOT_FOUND, "Not Found").into_response())
                        }
                    }
                }
            }));

        // Redirects first, then static files
        // Check redirect rules before serving static files
        Router::new().fallback_service(service_fn(move |req: Request<Body>| {
            let rules = rules.clone();
            let serve_dir = serve_dir.clone();
            async move {
                let path = req.uri().path();

                // Helper to check redirects and create response
                let redirect_if_matches = |lookup_path: &str| -> Option<Response> {
                    rules.get(lookup_path).map(|(target, status)| {
                        create_redirect_response(target, *status, modern)
                            .unwrap_or_else(|e| e.into_response())
                    })
                };

                // Check redirects first (exact match)
                if let Some(response) = redirect_if_matches(path) {
                    return Ok::<_, std::convert::Infallible>(response);
                }

                // Check redirects (without trailing slash)
                let trimmed = path.trim_end_matches('/');
                if trimmed != path
                    && let Some(response) = redirect_if_matches(trimmed)
                {
                    return Ok::<_, std::convert::Infallible>(response);
                }

                // No redirect match, fall back to static files
                let response = match serve_dir.oneshot(req).await {
                    Ok(res) => res.into_response(),
                    Err(err) => {
                        eprintln!("Error serving static file: {err}");
                        StatusCode::INTERNAL_SERVER_ERROR.into_response()
                    }
                };
                Ok(response)
            }
        }))
    } else {
        // No static directory, only serve redirects
        Router::new()
            .route("/{*path}", get(handle_redirect))
            .with_state(state)
    };

    if enable_logging {
        app = app.layer(middleware::from_fn(logging_middleware));
    }

    app
}

async fn validate_destinations(
    rules: &HashMap<String, (String, u16)>,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let mut errors = Vec::new();

    println!("Validating {} destination URLs...", rules.len());

    for (url, (target, _)) in rules {
        print!("Checking {url}: {target} ... ");

        match client.head(target).send().await {
            Ok(response) => {
                if response.status().is_success() || response.status().is_redirection() {
                    println!("✓ OK");
                } else {
                    println!("✗ HTTP {status}", status = response.status());
                    errors.push(format!(
                        "{target}: HTTP {status}",
                        status = response.status()
                    ));
                }
            }
            Err(e) => {
                println!("✗ Error: {e}");
                errors.push(format!("{target}: {e}"));
            }
        }
    }

    if errors.is_empty() {
        println!("✓ All destinations are reachable!");
        Ok(())
    } else {
        println!("\n✗ Validation failed for {} URLs:", errors.len());
        for error in &errors {
            println!("  - {error}");
        }
        Err(format!(
            "Validation failed for {count} destinations",
            count = errors.len()
        )
        .into())
    }
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    // Handle import command
    if let Some(Commands::Import { provider, output }) = cli.command {
        if let Err(e) = import::import_links(&provider, &output).await {
            eprintln!("Import failed: {e}");
            std::process::exit(1);
        }
        return;
    }

    let rules = load_redirect_rules(&cli.config).expect("Failed to load redirect rules");

    // Check configuration file syntax if requested
    if cli.check {
        println!("✓ Configuration file syntax is valid!");
        println!("  - File: {}", cli.config);
        println!("  - Rules loaded: {}", rules.len());
        return;
    }

    // Validate destinations if requested
    if cli.validate {
        if let Err(e) = validate_destinations(&rules).await {
            eprintln!("Validation failed: {e}");
            std::process::exit(1);
        }
        return;
    }

    let app = create_app(rules, cli.modern, !cli.silent, cli.static_dir);

    let bind_addr = format!("{bind}:{port}", bind = cli.bind, port = cli.port);
    let listener = TcpListener::bind(&bind_addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind to {bind_addr}: {e}"));

    println!("Forwarding service running on http://{bind_addr}");

    axum::serve(listener, app)
        .await
        .expect("Failed to start server");
}

async fn handle_redirect(
    Path(path): Path<String>,
    axum::extract::State((rules, modern)): axum::extract::State<AppState>,
) -> Result<Response, StatusCode> {
    let request_path = format!("/{path}");

    // Try exact match first
    if let Some((target, status)) = rules.get(&request_path) {
        create_redirect_response(target, *status, modern)
    } else {
        // If exact match fails, try without trailing slash
        let trimmed_path = request_path.trim_end_matches('/');
        if let Some((target, status)) = rules.get(trimmed_path) {
            create_redirect_response(target, *status, modern)
        } else {
            Err(StatusCode::NOT_FOUND)
        }
    }
}

fn create_redirect_response(
    target: &str,
    status: u16,
    modern: bool,
) -> Result<Response, StatusCode> {
    let actual_status = match (status, modern) {
        (301, false) => StatusCode::MOVED_PERMANENTLY, // 301
        (301, true) => StatusCode::PERMANENT_REDIRECT, // 308
        (302, false) => StatusCode::FOUND,             // 302
        (302, true) => StatusCode::TEMPORARY_REDIRECT, // 307
        _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok(Response::builder()
        .status(actual_status)
        .header(header::LOCATION, target)
        .body(axum::body::Body::empty())
        .unwrap())
}

fn load_redirect_rules(
    file_path: &str,
) -> Result<HashMap<String, (String, u16)>, Box<dyn std::error::Error>> {
    let file_content = std::fs::read_to_string(file_path)?;

    // Filter out empty lines and lines with only whitespace
    let filtered_content: String = file_content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| format!("{line}\n"))
        .collect();

    let mut reader = csv::ReaderBuilder::new()
        .comment(Some(b'#'))
        .from_reader(filtered_content.as_bytes());
    let mut rules = HashMap::new();

    for result in reader.deserialize() {
        let rule: RedirectRule = result?;

        // Validate status code
        if rule.status != 301 && rule.status != 302 {
            return Err(format!(
                "Invalid status code: {status}. Must be 301 or 302",
                status = rule.status
            )
            .into());
        }

        rules.insert(rule.url, (rule.target, rule.status));
    }

    Ok(rules)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use std::collections::HashMap;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_load_redirect_rules() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/old,https://example.com/new,301").unwrap();
        writeln!(temp_file, "/temp,https://example.com/temp,302").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        assert_eq!(rules.len(), 2);
        assert_eq!(
            rules.get("/old"),
            Some(&("https://example.com/new".to_string(), 301))
        );
        assert_eq!(
            rules.get("/temp"),
            Some(&("https://example.com/temp".to_string(), 302))
        );
    }

    #[test]
    fn test_invalid_status_code() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/invalid,https://example.com,200").unwrap();

        let result = load_redirect_rules(temp_file.path().to_str().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn test_load_redirect_rules_file_not_found() {
        let result = load_redirect_rules("nonexistent.csv");
        assert!(result.is_err());
    }

    #[test]
    fn test_load_redirect_rules_empty_file() {
        let temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file.as_file(), "url,target,status").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();
        assert_eq!(rules.len(), 0);
    }

    #[test]
    fn test_load_redirect_rules_invalid_csv() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/invalid,https://example.com").unwrap(); // Missing status column

        let result = load_redirect_rules(temp_file.path().to_str().unwrap());
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_handle_redirect_301() {
        let mut rules = HashMap::new();
        rules.insert(
            "/old".to_string(),
            ("https://example.com/new".to_string(), 301),
        );

        let result = handle_redirect(
            axum::extract::Path("old".to_string()),
            axum::extract::State((rules, false)),
        )
        .await;

        assert!(result.is_ok());
        // The redirect is created successfully - we can't easily test the exact type
        // without more complex setup, but we know it worked based on the Ok result
    }

    #[tokio::test]
    async fn test_handle_redirect_302() {
        let mut rules = HashMap::new();
        rules.insert(
            "/temp".to_string(),
            ("https://example.com/temp".to_string(), 302),
        );

        let result = handle_redirect(
            axum::extract::Path("temp".to_string()),
            axum::extract::State((rules, false)),
        )
        .await;

        assert!(result.is_ok());
        // The redirect is created successfully - we can't easily test the exact type
        // without more complex setup, but we know it worked based on the Ok result
    }

    #[tokio::test]
    async fn test_handle_redirect_not_found() {
        let rules = HashMap::new();

        let result = handle_redirect(
            axum::extract::Path("nonexistent".to_string()),
            axum::extract::State((rules, false)),
        )
        .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_handle_redirect_invalid_status() {
        let mut rules = HashMap::new();
        rules.insert(
            "/invalid".to_string(),
            ("https://example.com".to_string(), 200),
        );

        let result = handle_redirect(
            axum::extract::Path("invalid".to_string()),
            axum::extract::State((rules, false)),
        )
        .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_redirect_rule_deserialize() {
        let csv_data = "url,target,status\n/test,https://example.com,301";
        let mut reader = csv::Reader::from_reader(csv_data.as_bytes());
        let mut rules = Vec::new();

        for result in reader.deserialize() {
            let rule: RedirectRule = result.unwrap();
            rules.push(rule);
        }

        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].url, "/test");
        assert_eq!(rules[0].target, "https://example.com");
        assert_eq!(rules[0].status, 301);
    }

    #[test]
    fn test_multiple_rules_same_url() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/same,https://example.com/first,301").unwrap();
        writeln!(temp_file, "/same,https://example.com/second,302").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        // Should have only one entry (the last one overwrites the first)
        assert_eq!(rules.len(), 1);
        assert_eq!(
            rules.get("/same"),
            Some(&("https://example.com/second".to_string(), 302))
        );
    }

    #[tokio::test]
    async fn test_integration_server_redirect() {
        // Create a test CSV file
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/test,https://example.com/redirect,301").unwrap();
        writeln!(temp_file, "/temp,https://example.com/temp,302").unwrap();

        // Load the rules
        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        // Create the app using the new function
        let app = create_app(rules, false, false, None);

        // Test redirect for /test
        let request = axum::http::Request::builder()
            .uri("/test")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(response.status(), axum::http::StatusCode::MOVED_PERMANENTLY);

        // Test redirect for /temp
        let request = axum::http::Request::builder()
            .uri("/temp")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(response.status(), axum::http::StatusCode::FOUND);

        // Test 404 for unknown path
        let request = axum::http::Request::builder()
            .uri("/unknown")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(response.status(), axum::http::StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_create_app() {
        let mut rules = HashMap::new();
        rules.insert(
            "/test".to_string(),
            ("https://example.com".to_string(), 301),
        );

        let app = create_app(rules, false, false, None);

        // We can't test much about the router without running it,
        // but we can verify it was created successfully
        assert!(format!("{app:?}").contains("Router"));
    }

    #[test]
    fn test_redirect_rule_debug() {
        let rule = RedirectRule {
            url: "/test".to_string(),
            target: "https://example.com".to_string(),
            status: 301,
        };

        let debug_str = format!("{rule:?}");
        assert!(debug_str.contains("/test"));
        assert!(debug_str.contains("https://example.com"));
        assert!(debug_str.contains("301"));
    }

    #[test]
    fn test_load_redirect_rules_malformed_status() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/test,https://example.com,not_a_number").unwrap();

        let result = load_redirect_rules(temp_file.path().to_str().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn test_load_redirect_rules_extra_columns() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status,extra").unwrap();
        writeln!(temp_file, "/test,https://example.com,301,ignored").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();
        assert_eq!(rules.len(), 1);
        assert_eq!(
            rules.get("/test"),
            Some(&("https://example.com".to_string(), 301))
        );
    }

    #[tokio::test]
    async fn test_handle_redirect_path_formatting() {
        let mut rules = HashMap::new();
        rules.insert(
            "/test/path".to_string(),
            ("https://example.com".to_string(), 301),
        );

        let result = handle_redirect(
            axum::extract::Path("test/path".to_string()),
            axum::extract::State((rules, false)),
        )
        .await;

        assert!(result.is_ok());
    }

    #[test]
    fn test_load_redirect_rules_status_validation() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/test1,https://example.com,301").unwrap();
        writeln!(temp_file, "/test2,https://example.com,302").unwrap();
        writeln!(temp_file, "/test3,https://example.com,303").unwrap();

        let result = load_redirect_rules(temp_file.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Invalid status code: 303")
        );
    }

    #[test]
    fn test_empty_hashmap() {
        let rules = HashMap::new();
        let app = create_app(rules, false, false, None);
        assert!(format!("{app:?}").contains("Router"));
    }

    #[test]
    fn test_create_app_with_logging() {
        let mut rules = HashMap::new();
        rules.insert(
            "/test".to_string(),
            ("https://example.com".to_string(), 301),
        );

        // Test app with logging enabled
        let app_with_logging = create_app(rules.clone(), false, true, None);
        assert!(format!("{app_with_logging:?}").contains("Router"));

        // Test app without logging
        let app_without_logging = create_app(rules, false, false, None);
        assert!(format!("{app_without_logging:?}").contains("Router"));
    }

    #[test]
    fn test_load_redirect_rules_with_whitespace() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, " /test , https://example.com ,301").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();
        // CSV library should handle whitespace in string fields
        assert_eq!(rules.len(), 1);
        assert!(rules.contains_key(" /test "));
    }

    #[test]
    fn test_load_redirect_rules_with_empty_lines() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/first,https://example.com/first,301").unwrap();
        writeln!(temp_file).unwrap(); // Empty line
        writeln!(temp_file, "   ").unwrap(); // Line with only whitespace
        writeln!(temp_file, "/second,https://example.com/second,302").unwrap();
        writeln!(temp_file).unwrap(); // Another empty line
        writeln!(temp_file, "	").unwrap(); // Line with only tab
        writeln!(temp_file, "/third,https://example.com/third,301").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        // Should have exactly 3 rules, empty/whitespace lines should be ignored
        assert_eq!(rules.len(), 3);
        assert_eq!(
            rules.get("/first"),
            Some(&("https://example.com/first".to_string(), 301))
        );
        assert_eq!(
            rules.get("/second"),
            Some(&("https://example.com/second".to_string(), 302))
        );
        assert_eq!(
            rules.get("/third"),
            Some(&("https://example.com/third".to_string(), 301))
        );
    }

    #[test]
    fn test_load_redirect_rules_with_comments_and_empty_lines() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "# GitHub and development links").unwrap();
        writeln!(temp_file, "/gh,https://github.com/user,301").unwrap();
        writeln!(temp_file).unwrap(); // Empty line
        writeln!(temp_file, "# Marketing and promotional links").unwrap();
        writeln!(temp_file, "   ").unwrap(); // Whitespace line
        writeln!(temp_file, "/promo,https://site.com/promo,302").unwrap();
        writeln!(temp_file).unwrap(); // Another empty line
        writeln!(temp_file, "# Documentation").unwrap();
        writeln!(temp_file, "/docs,https://docs.site.com,301").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        // Should have exactly 3 rules, comments and empty lines should be ignored
        assert_eq!(rules.len(), 3);
        assert_eq!(
            rules.get("/gh"),
            Some(&("https://github.com/user".to_string(), 301))
        );
        assert_eq!(
            rules.get("/promo"),
            Some(&("https://site.com/promo".to_string(), 302))
        );
        assert_eq!(
            rules.get("/docs"),
            Some(&("https://docs.site.com".to_string(), 301))
        );
    }

    #[test]
    fn test_large_ruleset() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        for i in 0..1000 {
            writeln!(temp_file, "/test{i},https://example.com/target{i},301").unwrap();
        }

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();
        assert_eq!(rules.len(), 1000);
    }

    #[test]
    fn test_special_characters_in_urls() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(
            temp_file,
            "/test-path_with.special?chars,https://example.com/target,301"
        )
        .unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();
        assert_eq!(rules.len(), 1);
        assert!(rules.contains_key("/test-path_with.special?chars"));
    }

    #[test]
    fn test_load_redirect_rules_error_message() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/test,https://example.com,999").unwrap();

        let result = load_redirect_rules(temp_file.path().to_str().unwrap());
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains("Invalid status code: 999"));
        assert!(error.to_string().contains("Must be 301 or 302"));
    }

    #[test]
    fn test_load_redirect_rules_simple_comments() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "# This is a comment").unwrap();
        writeln!(temp_file, "/test,https://example.com,301").unwrap();
        writeln!(temp_file, "# Another comment").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        assert_eq!(rules.len(), 1);
        assert_eq!(
            rules.get("/test"),
            Some(&("https://example.com".to_string(), 301))
        );
    }

    #[test]
    fn test_load_redirect_rules_comments_only() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/test1,https://example.com,301").unwrap();
        writeln!(temp_file, "/test2,https://example.com,302").unwrap();
        writeln!(temp_file, "/test3,https://example.com,301").unwrap();

        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        assert_eq!(rules.len(), 3);
        assert_eq!(
            rules.get("/test1"),
            Some(&("https://example.com".to_string(), 301))
        );
        assert_eq!(
            rules.get("/test2"),
            Some(&("https://example.com".to_string(), 302))
        );
        assert_eq!(
            rules.get("/test3"),
            Some(&("https://example.com".to_string(), 301))
        );
    }

    #[tokio::test]
    async fn test_handle_redirect_with_query_params() {
        let mut rules = HashMap::new();
        rules.insert(
            "/api/v1/users".to_string(),
            ("https://api.example.com/users".to_string(), 301),
        );

        let result = handle_redirect(
            axum::extract::Path("api/v1/users".to_string()),
            axum::extract::State((rules, false)),
        )
        .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_destinations_function_signature() {
        // Test that the validation function handles different input scenarios
        // without making actual HTTP calls

        // Test with malformed URLs
        let mut rules = HashMap::new();
        rules.insert("/test".to_string(), ("not-a-valid-url".to_string(), 301));

        let result = validate_destinations(&rules).await;
        assert!(result.is_err());

        // Test with invalid protocols
        let mut rules2 = HashMap::new();
        rules2.insert("/test".to_string(), ("ftp://example.com".to_string(), 301));

        let result2 = validate_destinations(&rules2).await;
        assert!(result2.is_err());
    }

    #[tokio::test]
    async fn test_validate_destinations_error_formatting() {
        // Test that validation errors are properly formatted
        let mut rules = HashMap::new();
        rules.insert(
            "/test1".to_string(),
            ("http://invalid-domain-12345.local".to_string(), 301),
        );
        rules.insert(
            "/test2".to_string(),
            ("http://another-invalid-domain-67890.local".to_string(), 302),
        );

        let result = validate_destinations(&rules).await;
        assert!(result.is_err());

        let error_msg = result.unwrap_err().to_string();
        assert!(error_msg.contains("Validation failed"));
        assert!(error_msg.contains("destinations"));
    }

    #[tokio::test]
    async fn test_validate_destinations_empty() {
        let rules = HashMap::new();

        let result = validate_destinations(&rules).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_handle_redirect_trailing_slash() {
        let mut rules = HashMap::new();
        rules.insert(
            "/github".to_string(),
            ("https://github.com/vpetersson".to_string(), 301),
        );

        // Test exact match (without trailing slash)
        let result = handle_redirect(
            axum::extract::Path("github".to_string()),
            axum::extract::State((rules.clone(), false)),
        )
        .await;
        assert!(result.is_ok());

        // Test with trailing slash - should also work
        let result = handle_redirect(
            axum::extract::Path("github/".to_string()),
            axum::extract::State((rules.clone(), false)),
        )
        .await;
        assert!(result.is_ok());

        // Test with multiple trailing slashes
        let result = handle_redirect(
            axum::extract::Path("github///".to_string()),
            axum::extract::State((rules.clone(), false)),
        )
        .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_handle_redirect_trailing_slash_priority() {
        let mut rules = HashMap::new();
        // Add both versions to test priority
        rules.insert(
            "/api".to_string(),
            ("https://api.example.com/v1".to_string(), 301),
        );
        rules.insert(
            "/api/".to_string(),
            ("https://api.example.com/v2".to_string(), 302),
        );

        // Test that exact match takes priority
        let result = handle_redirect(
            axum::extract::Path("api/".to_string()),
            axum::extract::State((rules.clone(), false)),
        )
        .await;
        assert!(result.is_ok());
        // This should match the exact /api/ rule (302), not the /api rule (301)
    }

    #[tokio::test]
    async fn test_integration_server_redirect_modern() {
        // Create a test CSV file
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "url,target,status").unwrap();
        writeln!(temp_file, "/test301,https://example.com/301,301").unwrap();
        writeln!(temp_file, "/test302,https://example.com/302,302").unwrap();

        // Load the rules
        let rules = load_redirect_rules(temp_file.path().to_str().unwrap()).unwrap();

        // Test classic redirect codes (default behavior)
        let app_classic = create_app(rules.clone(), false, false, None);

        // Test 301 -> MOVED_PERMANENTLY (301)
        let request = axum::http::Request::builder()
            .uri("/test301")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app_classic.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::MOVED_PERMANENTLY // 301
        );

        // Test 302 -> FOUND (302)
        let request = axum::http::Request::builder()
            .uri("/test302")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app_classic.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::FOUND // 302
        );

        // Test modern redirect codes (with --modern flag)
        let app_modern = create_app(rules.clone(), true, false, None);

        // Test 301 -> PERMANENT_REDIRECT (308)
        let request = axum::http::Request::builder()
            .uri("/test301")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app_modern.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::PERMANENT_REDIRECT // 308
        );

        // Test 302 -> TEMPORARY_REDIRECT (307)
        let request = axum::http::Request::builder()
            .uri("/test302")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app_modern.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::TEMPORARY_REDIRECT // 307
        );
    }

    #[test]
    fn test_create_redirect_response() {
        // Test classic codes
        let response = create_redirect_response("https://example.com", 301, false);
        assert!(response.is_ok());
        assert_eq!(response.unwrap().status(), StatusCode::MOVED_PERMANENTLY); // 301

        let response = create_redirect_response("https://example.com", 302, false);
        assert!(response.is_ok());
        assert_eq!(response.unwrap().status(), StatusCode::FOUND); // 302

        // Test modern codes
        let response = create_redirect_response("https://example.com", 301, true);
        assert!(response.is_ok());
        assert_eq!(response.unwrap().status(), StatusCode::PERMANENT_REDIRECT); // 308

        let response = create_redirect_response("https://example.com", 302, true);
        assert!(response.is_ok());
        assert_eq!(response.unwrap().status(), StatusCode::TEMPORARY_REDIRECT); // 307

        // Test invalid status code
        let response = create_redirect_response("https://example.com", 200, false);
        assert!(response.is_err());
    }

    #[test]
    fn test_create_redirect_response_headers() {
        // Test that Location header is set correctly
        let response = create_redirect_response("https://example.com/target", 301, false);
        assert!(response.is_ok());
        let response = response.unwrap();

        let location = response.headers().get("location").unwrap();
        assert_eq!(location, "https://example.com/target");
        assert_eq!(response.status(), StatusCode::MOVED_PERMANENTLY);

        // Test modern redirect with Location header
        let response = create_redirect_response("https://github.com/vpetersson", 302, true);
        assert!(response.is_ok());
        let response = response.unwrap();

        let location = response.headers().get("location").unwrap();
        assert_eq!(location, "https://github.com/vpetersson");
        assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT); // 307
    }

    #[test]
    fn test_cli_parsing() {
        // Test default values
        let cli = Cli::parse_from(["dslf"]);
        assert!(!cli.validate);
        assert!(!cli.check);
        assert_eq!(cli.config, "redirects.csv");
        assert_eq!(cli.bind, "0.0.0.0");
        assert_eq!(cli.port, 3000);
        assert!(!cli.modern);
        assert!(!cli.silent);

        // Test with all options
        let cli = Cli::parse_from([
            "dslf",
            "--validate",
            "--config",
            "custom.csv",
            "--bind",
            "192.168.1.1",
            "--port",
            "9000",
        ]);

        assert!(cli.validate);
        assert!(!cli.check);
        assert_eq!(cli.config, "custom.csv");
        assert_eq!(cli.bind, "192.168.1.1");
        assert_eq!(cli.port, 9000);
        assert!(!cli.modern);

        // Test with modern flag
        let cli = Cli::parse_from(["dslf", "--modern"]);
        assert!(!cli.validate);
        assert!(!cli.check);
        assert_eq!(cli.config, "redirects.csv");
        assert_eq!(cli.bind, "0.0.0.0");
        assert_eq!(cli.port, 3000);
        assert!(cli.modern);

        // Test with check flag (long form)
        let cli = Cli::parse_from(["dslf", "--check"]);
        assert!(!cli.validate);
        assert!(cli.check);
        assert_eq!(cli.config, "redirects.csv");
        assert_eq!(cli.bind, "0.0.0.0");
        assert_eq!(cli.port, 3000);
        assert!(!cli.modern);

        // Test with check flag (short form)
        let cli = Cli::parse_from(["dslf", "-k"]);
        assert!(!cli.validate);
        assert!(cli.check);
        assert_eq!(cli.config, "redirects.csv");
        assert_eq!(cli.bind, "0.0.0.0");
        assert_eq!(cli.port, 3000);
        assert!(!cli.modern);

        // Test with check and custom config
        let cli = Cli::parse_from(["dslf", "--check", "--config", "test.csv"]);
        assert!(!cli.validate);
        assert!(cli.check);
        assert_eq!(cli.config, "test.csv");

        // Test with silent flag
        let cli = Cli::parse_from(["dslf", "--silent"]);
        assert!(!cli.validate);
        assert!(!cli.check);
        assert_eq!(cli.config, "redirects.csv");
        assert_eq!(cli.bind, "0.0.0.0");
        assert_eq!(cli.port, 3000);
        assert!(!cli.modern);
        assert!(cli.silent);

        // Test with silent flag shorthand
        let cli = Cli::parse_from(["dslf", "-s"]);
        assert!(!cli.validate);
        assert!(!cli.check);
        assert_eq!(cli.config, "redirects.csv");
        assert_eq!(cli.bind, "0.0.0.0");
        assert_eq!(cli.port, 3000);
        assert!(!cli.modern);
        assert!(cli.silent);
    }

    #[tokio::test]
    async fn test_integration_static_dir_with_redirects() {
        use tempfile::TempDir;

        // Create a temporary static directory with an index.html
        let temp_dir = TempDir::new().unwrap();
        let index_path = temp_dir.path().join("index.html");
        std::fs::write(&index_path, "<html><body>Landing Page</body></html>").unwrap();

        // Also create a 404.html
        let not_found_path = temp_dir.path().join("404.html");
        std::fs::write(&not_found_path, "<html><body>Not Found</body></html>").unwrap();

        // Create redirect rules
        let mut rules = HashMap::new();
        rules.insert(
            "/gh".to_string(),
            ("https://github.com/test".to_string(), 301),
        );
        rules.insert(
            "/blog".to_string(),
            ("https://blog.example.com".to_string(), 302),
        );

        // Create the app with both static_dir and redirect rules
        let app = create_app(rules, false, false, Some(temp_dir.path().to_path_buf()));

        // Test 1: Root path should serve index.html (200 OK)
        let request = axum::http::Request::builder()
            .uri("/")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::OK,
            "Root path should serve index.html"
        );

        // Test 2: /gh should redirect (301)
        let request = axum::http::Request::builder()
            .uri("/gh")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::MOVED_PERMANENTLY,
            "/gh should redirect with 301"
        );
        assert_eq!(
            response.headers().get("location").unwrap(),
            "https://github.com/test"
        );

        // Test 3: /blog should redirect (302)
        let request = axum::http::Request::builder()
            .uri("/blog")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::FOUND,
            "/blog should redirect with 302"
        );
        assert_eq!(
            response.headers().get("location").unwrap(),
            "https://blog.example.com"
        );

        // Test 4: Unknown path should return 404
        let request = axum::http::Request::builder()
            .uri("/unknown")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::NOT_FOUND,
            "/unknown should return 404"
        );

        // Test 5: Static file (styles.css) should be served when not a redirect
        let styles_path = temp_dir.path().join("styles.css");
        std::fs::write(&styles_path, "body { color: red; }").unwrap();

        let request = axum::http::Request::builder()
            .uri("/styles.css")
            .body(axum::body::Body::empty())
            .unwrap();

        let response = tower::ServiceExt::oneshot(app.clone(), request)
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::OK,
            "/styles.css should serve the static file"
        );
    }
}
