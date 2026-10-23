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

/// Provider ids and the hosts their conversation links may use. Mirrors the `hosts` map in `src/providers.mjs`.
pub const PROVIDER_HOSTS: &[(&str, &[&str])] = &[
    ("claude", &["claude.ai"]),
    ("chatgpt", &["chatgpt.com"]),
    ("codex", &["chatgpt.com"]),
    ("claude-code", &["claude.ai"]),
    ("grok", &["grok.com"]),
];

/// A conversation link must be official *and* belong to the service it claims.
pub fn validate_chat_url(raw: &str, provider: &str) -> Result<url::Url, String> {
    let hosts = PROVIDER_HOSTS
        .iter()
        .find(|(id, _)| *id == provider)
        .map(|(_, hosts)| *hosts)
        .ok_or_else(|| "Unknown service.".to_string())?;
    let parsed = validate_official_url(raw)?;
    if !hosts.contains(&parsed.host_str().unwrap_or_default()) {
        return Err("That link does not belong to the service it names.".into());
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

    #[test]
    fn chat_links_must_match_their_service() {
        assert!(validate_chat_url("https://claude.ai/chat/abc", "claude").is_ok());
        assert!(validate_chat_url("https://chatgpt.com/c/abc", "chatgpt").is_ok());
        assert!(validate_chat_url("https://chatgpt.com/codex/abc", "codex").is_ok());
        // Official, but the wrong service for the link.
        assert!(validate_chat_url("https://claude.ai/chat/abc", "chatgpt").is_err());
        assert!(validate_chat_url("https://grok.com/c/abc", "claude").is_err());
        // Unknown provider ids and hostile links stay rejected.
        assert!(validate_chat_url("https://claude.ai/chat/abc", "pirate").is_err());
        assert!(validate_chat_url("http://claude.ai/chat/abc", "claude").is_err());
    }
}
