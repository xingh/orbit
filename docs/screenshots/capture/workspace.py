"""Generate a demo workspace with the same SHAPE as a real one, and none of its content.

The counts match a real import (437 Claude chats, 618 ChatGPT chats, 21 Claude projects,
5 ChatGPT projects = 1081 entries) so the screenshots show honestly how the app behaves when
it is full. The titles are synthetic: README images are published, and what Orbit stores is
exactly the titles of someone's conversations.
"""
import json, random

SUBJECTS = [
    "Tauri transparent windows", "Rust ownership", "SQLite WAL mode", "React Suspense",
    "Three.js instancing", "pgvector similarity", "MV3 service workers", "CSS container queries",
    "Postgres row level security", "WebGL context loss", "Vite chunk splitting", "cargo workspaces",
    "HiDPI scale factors", "X11 window hints", "AppImage packaging", "code signing on macOS",
    "GitHub Actions matrices", "cursor pagination", "constant time comparison", "tokio tasks",
    "serde untagged enums", "IndexedDB storage", "Snappy framing", "Web Share Target",
    "service discovery on loopback", "global shortcuts", "tray menus", "drag regions",
    "reduced motion", "focus trapping", "colour contrast", "prefers-color-scheme",
    "SQLite migrations", "versioned backups", "tombstones and deletes", "last write wins",
    "QR pairing flows", "device credentials", "token rotation", "CORS preflights",
]
FORMS = [
    "{s}", "{s} questions", "Debugging {s}", "{s} — first pass", "Notes on {s}",
    "Why does {s} fail?", "Rewriting {s}", "{s} in practice", "Reviewing {s}",
    "{s}: what I got wrong", "Planning {s}", "Shipping {s}", "{s} edge cases",
]
PROJECT_NAMES = [
    "Orbit widget", "Companion service", "Browser extension", "History import", "Robot genome",
    "Release pipeline", "Shared workspaces", "Mobile client", "Design system", "Storage rewrite",
    "Provider adapters", "Accessibility pass", "Packaging", "Telemetry-free analytics",
    "Docs and onboarding", "Security review", "Performance budget", "Icon set",
    "Pairing flow", "Backup format", "Search ranking", "Deployment modes",
    "Vector search spike", "Changelog automation", "Issue triage", "Fleet experiments",
]
NOTES = [
    "", "", "", "picked this back up after the rewrite", "the answer was in the second half",
    "worth re-reading before the next pass", "superseded by the newer thread", "",
    "keep for the benchmark numbers", "", "started from the failing test",
]


def build(seed: int = 7) -> dict:
    rng = random.Random(seed)
    items, used = [], set()

    def title() -> str:
        for _ in range(200):
            t = rng.choice(FORMS).format(s=rng.choice(SUBJECTS))
            if t not in used:
                used.add(t)
                return t
        return f"{rng.choice(SUBJECTS)} {rng.randrange(10**4)}"

    now = 1761200000000
    projects = []
    for i, name in enumerate(PROJECT_NAMES[:21]):
        pid = f"claude-project-demo{i:04d}"
        projects.append((pid, "claude"))
        items.append({"id": pid, "type": "project", "title": name, "provider": "claude",
                      "url": f"https://claude.ai/project/demo{i:04d}", "folder": "", "note": "",
                      "pinned": i < 2, "updated": now - i * 86400000})
    for i, name in enumerate(["Writing assistant", "Research sweeps", "Interview prep",
                              "Travel planning", "Reading list"]):
        pid = f"chatgpt-g-p-demo{i:04d}"
        projects.append((pid, "chatgpt"))
        items.append({"id": pid, "type": "project", "title": name, "provider": "chatgpt",
                      "url": f"https://chatgpt.com/g/g-p-demo{i:04d}", "folder": "", "note": "",
                      "pinned": False, "updated": now - (i + 21) * 86400000})

    def chats(count: int, provider: str, prefix: str, url: str):
        pool = [p for p, who in projects if who == provider]
        for i in range(count):
            linked = rng.random() < 0.42
            items.append({
                "id": f"{prefix}{i:05d}", "type": "chat", "title": title(), "provider": provider,
                "url": url.format(i=i), "folder": "", "note": rng.choice(NOTES),
                "pinned": i < 2, "updated": now - rng.randrange(400) * 3600000,
                "projectId": rng.choice(pool) if linked and pool else "",
            })

    chats(437, "claude", "claude-chat-demo", "https://claude.ai/chat/demo{i:05d}")
    chats(618, "chatgpt", "chatgpt-demo", "https://chatgpt.com/c/demo{i:05d}")
    return {"items": items, "settings": {"grok": False, "compact": False, "robot": True}}


if __name__ == "__main__":
    data = build()
    kinds = {}
    for item in data["items"]:
        kinds[(item["type"], item["provider"])] = kinds.get((item["type"], item["provider"]), 0) + 1
    print(len(data["items"]), "entries", kinds)
    print(json.dumps(data)[:200])
