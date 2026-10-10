//! Official provider hosts. Mirrors `src/providers.mjs`; native code validates again before opening.

pub const OFFICIAL_HOSTS: &[&str] = &["claude.ai", "chatgpt.com", "grok.com"];

pub fn validate_official_url(raw: &str) -> Result<url::Url, String> {
    let parsed = url::Url::parse(raw).map_err(|_| "Invalid URL".to_string())?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.port().is_some()
        || !OFFICIAL_HOSTS.contains(&host)
    {
        return Err("Only official HTTPS service links can be opened.".into());
    }
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_official_links() {
        for url in [
            "https://claude.ai/new",
            "https://chatgpt.com/codex",
            "https://grok.com/",
            "https://claude.ai/code",
        ] {
            assert!(validate_official_url(url).is_ok(), "{url}");
        }
    }

    #[test]
    fn rejects_hostile_links() {
        for url in [
            "javascript:alert(1)",
            "http://claude.ai/chat/1",
            "https://claude.ai.evil.com/",
            "https://evil.com/?claude.ai",
            "https://user:pass@claude.ai/chat/1",
            "https://claude.ai:8443/chat/1",
            "file:///etc/passwd",
            "file:///C:/Windows",
        ] {
            assert!(validate_official_url(url).is_err(), "{url}");
        }
    }
}
