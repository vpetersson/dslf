use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::error::Error;
use std::fs::File;

#[derive(Debug, Deserialize)]
struct RebrandlyLink {
    id: String,
    #[allow(dead_code)]
    title: Option<String>,
    slashtag: String,
    destination: String,
    #[allow(dead_code)]
    #[serde(rename = "createdAt")]
    created_at: String,
    #[allow(dead_code)]
    #[serde(rename = "updatedAt")]
    updated_at: String,
    #[allow(dead_code)]
    #[serde(rename = "shortUrl")]
    short_url: String,
    #[allow(dead_code)]
    favourite: Option<bool>,
    domain: RebrandlyDomain,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RebrandlyDomain {
    #[allow(dead_code)]
    id: String,
    #[serde(rename = "fullName")]
    full_name: String,
}

#[derive(Debug, Serialize)]
struct DslfRedirect {
    url: String,
    target: String,
    status: u16,
}

pub async fn import_from_rebrandly(output_file: &str) -> Result<(), Box<dyn Error>> {
    let api_key = env::var("REBRANDLY_API_KEY")
        .or_else(|_| env::var("REBRANDLY_TOKEN"))
        .map_err(|_| "REBRANDLY_API_KEY or REBRANDLY_TOKEN environment variable not set")?;

    let client = Client::new();
    let mut all_links = Vec::new();
    let mut last_id: Option<String> = None;
    let limit = 25; // Maximum allowed by Rebrandly API

    println!("Fetching links from Rebrandly...");

    loop {
        let mut url = format!("https://api.rebrandly.com/v1/links?limit={limit}");

        if let Some(last) = &last_id {
            url.push_str(&format!("&last={last}"));
        }

        println!("Fetching batch (last ID: {last_id:?})");

        let response = client
            .get(&url)
            .header("apikey", &api_key)
            .header("Content-Type", "application/json")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("Rebrandly API error {status}: {error_text}").into());
        }

        let links: Vec<RebrandlyLink> = response.json().await?;

        if links.is_empty() {
            println!("No more links to fetch.");
            break;
        }

        println!("Fetched {} links in this batch", links.len());

        // Store the last ID for pagination
        if let Some(last_link) = links.last() {
            last_id = Some(last_link.id.clone());
        }

        let batch_size = links.len();
        all_links.extend(links);

        // If we got fewer links than the limit, we've reached the end
        if batch_size < limit {
            break;
        }
    }

    println!("Total links fetched: {}", all_links.len());

    if all_links.is_empty() {
        println!("No links found to export.");
        return Ok(());
    }

    // Convert to DSLF format
    let mut redirects = Vec::new();
    let mut domain_counts: HashMap<String, usize> = HashMap::new();

    for link in all_links {
        // Skip inactive links
        if let Some(status) = &link.status {
            if status != "active" {
                continue;
            }
        }

        // Create the short URL path
        let url_path = if link.slashtag.starts_with('/') {
            link.slashtag
        } else {
            format!("/{}", link.slashtag)
        };

        // Convert to DSLF redirect
        let redirect = DslfRedirect {
            url: url_path,
            target: link.destination,
            status: 301, // Default to permanent redirect
        };

        redirects.push(redirect);

        // Count domains for summary
        *domain_counts.entry(link.domain.full_name).or_insert(0) += 1;
    }

    // Write to CSV
    let mut file = File::create(output_file)?;
    let mut writer = csv::Writer::from_writer(&mut file);

    // Write redirects (headers are automatically written by csv crate on first serialize)
    for redirect in &redirects {
        writer.serialize(redirect)?;
    }

    writer.flush()?;

    println!(
        "✅ Successfully exported {} redirects to {output_file}",
        redirects.len()
    );
    println!("\nDomains summary:");
    for (domain, count) in domain_counts {
        println!("  - {domain}: {count} links");
    }

    Ok(())
}

pub async fn import_links(provider: &str, output_file: &str) -> Result<(), Box<dyn Error>> {
    match provider {
        "rebrandly" => import_from_rebrandly(output_file).await,
        _ => Err(format!("Unsupported import provider: {provider}").into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use tempfile::NamedTempFile;

    #[test]
    fn test_dslf_redirect_serialize() {
        let redirect = DslfRedirect {
            url: "/test".to_string(),
            target: "https://example.com".to_string(),
            status: 301,
        };

        let mut buffer = Vec::new();
        {
            let mut writer = csv::Writer::from_writer(&mut buffer);
            writer.serialize(&redirect).unwrap();
            writer.flush().unwrap();
        } // writer is dropped here, releasing the borrow

        let csv_content = String::from_utf8(buffer).unwrap();
        assert!(csv_content.contains("/test"));
        assert!(csv_content.contains("https://example.com"));
        assert!(csv_content.contains("301"));
    }

    #[test]
    fn test_rebrandly_link_deserialize() {
        let json_data = r#"
        {
            "id": "test123",
            "title": "Test Link",
            "slashtag": "test",
            "destination": "https://example.com",
            "createdAt": "2023-01-01T00:00:00.000Z",
            "updatedAt": "2023-01-01T00:00:00.000Z",
            "shortUrl": "rebrand.ly/test",
            "favourite": false,
            "domain": {
                "id": "domain123",
                "fullName": "rebrand.ly"
            },
            "status": "active"
        }
        "#;

        let link: RebrandlyLink = serde_json::from_str(json_data).unwrap();
        assert_eq!(link.id, "test123");
        assert_eq!(link.slashtag, "test");
        assert_eq!(link.destination, "https://example.com");
        assert_eq!(link.domain.full_name, "rebrand.ly");
        assert_eq!(link.status, Some("active".to_string()));
    }

    #[test]
    fn test_import_links_unsupported_provider() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let temp_file = NamedTempFile::new().unwrap();

        let result = rt.block_on(import_links(
            "unsupported",
            temp_file.path().to_str().unwrap(),
        ));
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Unsupported import provider")
        );
    }

    #[test]
    fn test_rebrandly_link_with_complex_urls() {
        // Test URLs with UTM parameters, query strings, fragments, etc.
        let json_data = r#"
        {
            "id": "complex123",
            "title": "Complex URL Test",
            "slashtag": "utm-test",
            "destination": "https://example.com/products/analytics?utm_source=newsletter&utm_medium=email&utm_campaign=spring_sale&utm_content=button&ref=homepage&category=tools&feature=advanced#pricing-section",
            "createdAt": "2023-01-01T00:00:00.000Z",
            "updatedAt": "2023-01-01T00:00:00.000Z",
            "shortUrl": "rebrand.ly/utm-test",
            "favourite": false,
            "domain": {
                "id": "domain123",
                "fullName": "rebrand.ly"
            },
            "status": "active"
        }
        "#;

        let link: RebrandlyLink = serde_json::from_str(json_data).unwrap();
        assert_eq!(link.id, "complex123");
        assert_eq!(link.slashtag, "utm-test");
        assert!(link.destination.contains("utm_source=newsletter"));
        assert!(link.destination.contains("utm_medium=email"));
        assert!(link.destination.contains("utm_campaign=spring_sale"));
        assert!(link.destination.contains("utm_content=button"));
        assert!(link.destination.contains("ref=homepage"));
        assert!(link.destination.contains("category=tools"));
        assert!(link.destination.contains("feature=advanced"));
        assert!(link.destination.contains("#pricing-section"));
        assert_eq!(link.domain.full_name, "rebrand.ly");
        assert_eq!(link.status, Some("active".to_string()));
    }

    #[test]
    fn test_csv_output_with_complex_urls() {
        // Test that complex URLs are properly escaped in CSV output
        let redirects = vec![
            DslfRedirect {
                url: "/utm-test".to_string(),
                target: "https://example.com/products?utm_source=newsletter&utm_medium=email&utm_campaign=spring_sale&ref=homepage#pricing".to_string(),
                status: 301,
            },
            DslfRedirect {
                url: "/special-chars".to_string(),
                target: "https://example.com/search?q=hello%20world&category=electronics&price=100-500&features=wifi,bluetooth".to_string(),
                status: 302,
            },
            DslfRedirect {
                url: "/encoded-url".to_string(),
                target: "https://example.com/redirect?url=https%3A%2F%2Fother-site.com%2Fpath%3Fparam%3Dvalue".to_string(),
                status: 301,
            },
        ];

        let mut buffer = Vec::new();
        {
            let mut writer = csv::Writer::from_writer(&mut buffer);
            for redirect in &redirects {
                writer.serialize(redirect).unwrap();
            }
            writer.flush().unwrap();
        }

        let csv_content = String::from_utf8(buffer).unwrap();

        // Check that header is present only once
        let header_count = csv_content.matches("url,target,status").count();
        assert_eq!(header_count, 1, "Should have exactly one header line");

        // Check that complex URLs are properly preserved
        assert!(csv_content.contains("utm_source=newsletter"));
        assert!(csv_content.contains("utm_medium=email"));
        assert!(csv_content.contains("utm_campaign=spring_sale"));
        assert!(csv_content.contains("#pricing"));
        assert!(csv_content.contains("q=hello%20world"));
        assert!(csv_content.contains("features=wifi,bluetooth"));
        assert!(csv_content.contains("https%3A%2F%2Fother-site.com"));

        // Check that all three redirects are present
        let lines: Vec<&str> = csv_content.lines().collect();
        assert_eq!(lines.len(), 4, "Should have 1 header + 3 data lines");
    }

    #[test]
    fn test_slashtag_formatting() {
        // Test various slashtag formats
        let test_cases = vec![
            ("simple", "/simple"),
            ("/already-slash", "/already-slash"),
            ("with-dashes", "/with-dashes"),
            ("with_underscores", "/with_underscores"),
            ("with123numbers", "/with123numbers"),
            ("MixedCase", "/MixedCase"),
        ];

        for (input, expected) in test_cases {
            let url_path = if input.starts_with('/') {
                input.to_string()
            } else {
                format!("/{input}")
            };

            assert_eq!(url_path, expected);
        }
    }

    #[tokio::test]
    async fn test_import_from_rebrandly_missing_api_key() {
        // Temporarily remove API key environment variables
        let original_api_key = env::var("REBRANDLY_API_KEY").ok();
        let original_token = env::var("REBRANDLY_TOKEN").ok();

        unsafe {
            env::remove_var("REBRANDLY_API_KEY");
            env::remove_var("REBRANDLY_TOKEN");
        }

        let temp_file = NamedTempFile::new().unwrap();
        let result = import_from_rebrandly(temp_file.path().to_str().unwrap()).await;

        // Restore environment variables if they existed
        unsafe {
            if let Some(key) = original_api_key {
                env::set_var("REBRANDLY_API_KEY", key);
            }
            if let Some(token) = original_token {
                env::set_var("REBRANDLY_TOKEN", token);
            }
        }

        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("environment variable not set")
        );
    }
}
