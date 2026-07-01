#!/usr/bin/env python3
"""
FF Social Scheduler — Content Export Script

Usage:
  python export-to-scheduler.py <content-folder>
  python export-to-scheduler.py <content-folder> --start "2026-06-28 10:00" --gap 4
  python export-to-scheduler.py <content-folder> --dry-run

Reads posts.json from the content folder, uploads each file to Cloudinary,
then submits to the n8n scheduling webhook.

posts.json format:
[
  {
    "file": "feed_sunday.png",
    "type": "feed",
    "caption": "Your caption here #hashtags",
    "scheduled_at": "2026-06-28T10:00:00",  // optional — use --start + --gap instead
    "needs_music": false,
    "notes": ""
  }
]
"""

import argparse
import json
import mimetypes
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME  = "dxh9cnlqu"
CLOUDINARY_UPLOAD_PRESET = "ml_default"
N8N_WEBHOOK_URL = "http://localhost:5678/webhook/ff-submit-post"
DEFAULT_GAP_HOURS = 4  # hours between auto-spaced posts

# Best-time windows for family/lifestyle content (NZST, 24h)
# Tuned for parents of young kids in Tauranga/NZ
BEST_TIMES = {
    "feed":  [9, 12, 19],   # nap time, lunch, after kids in bed
    "reel":  [8, 12, 20],   # early morning scroll, lunch, evening
    "story": [7, 12, 18],   # morning routine, lunch, school pickup
}
# ─────────────────────────────────────────────────────────────────────────────


def upload_to_cloudinary(file_path: Path) -> str:
    """Upload a file to Cloudinary and return the secure URL."""
    mime, _ = mimetypes.guess_type(str(file_path))
    is_video = mime and mime.startswith("video")
    resource_type = "video" if is_video else "image"

    url = f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/{resource_type}/upload"

    # Build multipart form data manually (no external deps)
    boundary = "----CloudinaryBoundary7MA4YWxkTrZu0gW"
    with open(file_path, "rb") as f:
        file_data = f.read()

    def part(name, value):
        return (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n"
        ).encode()

    body = (
        part("upload_preset", CLOUDINARY_UPLOAD_PRESET)
        + f"--{boundary}\r\n".encode()
        + f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'.encode()
        + f"Content-Type: {mime or 'application/octet-stream'}\r\n\r\n".encode()
        + file_data
        + f"\r\n--{boundary}--\r\n".encode()
    )

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=120) as res:
        result = json.loads(res.read())

    return result["secure_url"]


def submit_to_n8n(post: dict) -> dict:
    """POST a post payload to the n8n webhook."""
    data = json.dumps(post).encode()
    req = urllib.request.Request(
        N8N_WEBHOOK_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        body = res.read()
        return json.loads(body) if body.strip() else {"status": "ok"}


def best_time_on_day(date: datetime, post_type: str) -> datetime:
    """Return the best posting hour for a given date and post type."""
    windows = BEST_TIMES.get(post_type, BEST_TIMES["feed"])
    now = datetime.now()
    for hour in windows:
        candidate = date.replace(hour=hour, minute=0, second=0, microsecond=0)
        if candidate > now:
            return candidate
    # All windows past — use last window next day
    next_day = date + timedelta(days=1)
    return next_day.replace(hour=windows[-1], minute=0, second=0, microsecond=0)


def auto_schedule(posts: list, start: datetime, gap_hours: int, smart: bool = True) -> list:
    """Fill in scheduled_at for posts that don't have one."""
    t = start
    result = []
    for post in posts:
        p = dict(post)
        if not p.get("scheduled_at"):
            if smart:
                t = best_time_on_day(t, p.get("type", "feed"))
            p["scheduled_at"] = t.isoformat()
            t += timedelta(hours=gap_hours)
        else:
            existing = datetime.fromisoformat(p["scheduled_at"])
            if existing >= t:
                t = existing + timedelta(hours=gap_hours)
        result.append(p)
    return result


def main():
    parser = argparse.ArgumentParser(description="Export FF content to the social scheduler")
    parser.add_argument("folder", help="Content folder containing posts.json and media files")
    parser.add_argument("--start", help='Start datetime for auto-spacing, e.g. "2026-06-28 10:00"')
    parser.add_argument("--gap", type=int, default=DEFAULT_GAP_HOURS, help="Hours between posts (default 4)")
    parser.add_argument("--no-smart-timing", action="store_true", help="Disable best-time snapping, use exact --start + --gap intervals")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be submitted without sending")
    args = parser.parse_args()

    folder = Path(args.folder).resolve()
    manifest = folder / "posts.json"

    if not folder.exists():
        print(f"✗ Folder not found: {folder}")
        sys.exit(1)
    if not manifest.exists():
        print(f"✗ No posts.json found in {folder}")
        print("  Create a posts.json file listing your posts — see script header for format.")
        sys.exit(1)

    posts = json.loads(manifest.read_text())
    print(f"Found {len(posts)} post(s) in {manifest.name}\n")

    # Auto-schedule if start time given
    if args.start:
        try:
            start_dt = datetime.fromisoformat(args.start.replace(" ", "T"))
        except ValueError:
            print(f"✗ Invalid --start format. Use: \"2026-06-28 10:00\"")
            sys.exit(1)
        posts = auto_schedule(posts, start_dt, args.gap, smart=not args.no_smart_timing)
    else:
        # Check all posts have a scheduled_at
        missing = [i for i, p in enumerate(posts) if not p.get("scheduled_at")]
        if missing:
            print(f"✗ Posts at index {missing} have no scheduled_at.")
            print("  Either add scheduled_at to each post in posts.json,")
            print("  or use --start '2026-06-28 10:00' to auto-space them.")
            sys.exit(1)

    if args.dry_run:
        print("── DRY RUN — nothing will be uploaded or submitted ──\n")

    results = []
    for i, post in enumerate(posts, 1):
        file_path = folder / post["file"]
        label = f"[{i}/{len(posts)}] {post['file']}"

        if not file_path.exists():
            print(f"  {label}  ✗ file not found, skipping")
            results.append({"file": post["file"], "status": "skipped - file not found"})
            continue

        print(f"  {label}")
        print(f"    type:      {post.get('type', 'feed')}")
        print(f"    scheduled: {post.get('scheduled_at')}")
        caption_preview = (post.get("caption") or "")[:60]
        print(f"    caption:   {caption_preview}{'…' if len(post.get('caption','')) > 60 else ''}")
        if post.get("needs_music"):
            print(f"    🎵 needs music")

        if args.dry_run:
            print(f"    → would upload to Cloudinary then submit to n8n\n")
            results.append({"file": post["file"], "status": "dry-run"})
            continue

        # Upload to Cloudinary
        print(f"    ↑ uploading to Cloudinary…", end="", flush=True)
        try:
            media_url = upload_to_cloudinary(file_path)
            print(f" ✓")
        except Exception as e:
            print(f" ✗ {e}")
            results.append({"file": post["file"], "status": f"upload failed: {e}"})
            continue

        # Submit to n8n
        print(f"    → submitting to scheduler…", end="", flush=True)
        payload = {
            "type":         post.get("type", "feed"),
            "caption":      post.get("caption", ""),
            "media_url":    media_url,
            "scheduled_at": post["scheduled_at"],
            "needs_music":  post.get("needs_music", False),
            "notes":        post.get("notes", ""),
            "status":       post.get("status", "draft"),
        }
        try:
            response = submit_to_n8n(payload)
            post_id = response.get("id", "?")
            print(f" ✓  id: {post_id}")
            results.append({"file": post["file"], "status": "scheduled", "id": post_id, "url": media_url})
        except Exception as e:
            print(f" ✗ {e}")
            results.append({"file": post["file"], "status": f"submit failed: {e}", "url": media_url})

        print()

    # Summary
    print("─" * 50)
    scheduled = [r for r in results if r["status"] == "scheduled"]
    failed    = [r for r in results if "failed" in r["status"]]
    skipped   = [r for r in results if "skipped" in r["status"]]

    if args.dry_run:
        print(f"Dry run complete. {len(posts)} post(s) would be submitted.")
    else:
        print(f"Done.  ✓ {len(scheduled)} scheduled  |  ✗ {len(failed)} failed  |  — {len(skipped)} skipped")

    if failed:
        print("\nFailed:")
        for r in failed:
            print(f"  • {r['file']}: {r['status']}")


if __name__ == "__main__":
    main()
