"""
GitHub profile data fetcher for GitAudit.

Environment variables:
- GITHUB_TOKEN
- GITHUB_USERNAME

Writes:
- backend/data/profile_data.json

Returns:
- dict profile_data
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import requests

GITHUB_API_REST_BASE = "https://api.github.com"
GITHUB_API_GRAPHQL = "https://api.github.com/graphql"

MAX_RETRIES = 3


def utcnow():
    return datetime.now(timezone.utc)


def parse_iso_datetime(s):
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:
        return None


def days_ago(dt):
    if dt is None:
        return 0
    delta = utcnow() - dt
    return max(0, int(delta.total_seconds() // 86400))


def github_rest_headers(token):
    return {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitAudit-profile-fetcher",
    }


def github_graphql_headers(token):
    return {
        "Authorization": "bearer " + token,
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitAudit-profile-fetcher",
    }


def request_with_retries(method, url, headers, params=None, json_body=None, timeout_seconds=30):
    attempt = 0
    backoff_seconds = 1.0

    while True:
        resp = requests.request(
            method,
            url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=timeout_seconds,
        )

        if 200 <= resp.status_code < 300:
            return resp

        retry_after = resp.headers.get("Retry-After")
        try:
            retry_after_seconds = int(retry_after) if retry_after else None
        except Exception:
            retry_after_seconds = None

        should_retry = False
        status = resp.status_code
        reason = (resp.text or "")[:500].lower()
        remaining = resp.headers.get("X-RateLimit-Remaining")

        if status in (429, 403):
            if status == 429:
                should_retry = True
            elif "rate limit" in reason or remaining == "0":
                should_retry = True
            elif "secondary rate" in reason:
                should_retry = True
        elif 500 <= status <= 599:
            should_retry = True

        if (not should_retry) or attempt >= MAX_RETRIES:
            return resp

        if retry_after_seconds is not None:
            sleep_for = max(float(retry_after_seconds), backoff_seconds)
        else:
            sleep_for = backoff_seconds

        time.sleep(sleep_for)
        attempt += 1
        backoff_seconds *= 2.0


def rest_get_json(url, token, params=None):
    resp = request_with_retries(
        "GET",
        url,
        headers=github_rest_headers(token),
        params=params,
    )
    if 200 <= resp.status_code < 300:
        try:
            return resp.json()
        except Exception:
            return None
    return None


def graphql_post(query, variables, token):
    resp = request_with_retries(
        "POST",
        GITHUB_API_GRAPHQL,
        headers=github_graphql_headers(token),
        json_body={"query": query, "variables": variables},
    )
    if 200 <= resp.status_code < 300:
        try:
            return resp.json()
        except Exception:
            return None
    return None


def fetch_basic_profile(token, username):
    profile_url = GITHUB_API_REST_BASE + "/users/" + quote(username)
    resp_json = rest_get_json(profile_url, token, params=None)
    if not isinstance(resp_json, dict):
        return None
    return resp_json


def fetch_all_public_repos(token, username):
    repos = []
    page = 1
    while True:
        params = {"per_page": 100, "page": page, "type": "public", "sort": "pushed"}
        url = GITHUB_API_REST_BASE + "/users/" + quote(username) + "/repos"
        resp_json = rest_get_json(url, token, params=params)
        if not isinstance(resp_json, list) or not resp_json:
            break
        repos.extend(resp_json)
        if len(resp_json) < 100:
            break
        page += 1
    return repos


def fetch_repo_readme(token, owner, repo):
    url = GITHUB_API_REST_BASE + "/repos/" + quote(owner) + "/" + quote(repo) + "/readme"
    params = {"ref": "main"}
    resp = request_with_retries(
        "GET",
        url,
        headers=github_rest_headers(token),
        params=params,
    )
    if resp.status_code == 404:
        resp2 = request_with_retries(
            "GET",
            url,
            headers=github_rest_headers(token),
            params=None,
        )
        if resp2.status_code == 404:
            return ""
        if 200 <= resp2.status_code < 300:
            try:
                payload = resp2.json() or {}
                import base64
                encoded = payload.get("content") or ""
                decoded = base64.b64decode(encoded).decode("utf-8", errors="replace")
                return decoded
            except Exception:
                return ""
        return ""

    if 200 <= resp.status_code < 300:
        try:
            payload = resp.json() or {}
            import base64
            encoded = payload.get("content") or ""
            decoded = base64.b64decode(encoded).decode("utf-8", errors="replace")
            return decoded
        except Exception:
            return ""

    return ""


def fetch_commit_count_last_12_months(token, owner, repo):
    end = utcnow().date()
    start = (end - timedelta(days=365)).isoformat()
    end_iso = (end + timedelta(days=1)).isoformat()
    q = "repo:" + owner + "/" + repo + "+committer-date:>=" + start + "+committer-date:<" + end_iso
    params = {"q": q, "per_page": 1}
    url = GITHUB_API_REST_BASE + "/search/commits"
    resp_json = rest_get_json(url, token, params=params)
    if not isinstance(resp_json, dict):
        return 0
    try:
        return int(resp_json.get("total_count") or 0)
    except Exception:
        return 0


def fetch_pinned_repos(token, username):
    query = """
    query($login: String!) {
      user(login: $login) {
        repositories(
          first: 6
          isPinned: true
          privacy: PUBLIC
          orderBy: {field: PUSHED_AT, direction: DESC}
        ) {
          nodes { name }
        }
      }
    }
    """
    payload = graphql_post(query, {"login": username}, token)
    if not payload or payload.get("errors"):
        return []
    user = (payload.get("data") or {}).get("user") or {}
    repos = user.get("repositories") or {}
    nodes = repos.get("nodes") or []
    out = []
    for n in nodes:
        name = n.get("name")
        if name:
            out.append(name)
    return out


def fetch_contribution_graph(token, username):
    query = """
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
    """
    payload = graphql_post(query, {"login": username}, token)
    if not payload or payload.get("errors"):
        return 0, 0, 0

    user = (payload.get("data") or {}).get("user")
    if not user:
        return 0, 0, 0

    cal = ((user.get("contributionsCollection") or {}).get("contributionCalendar")) or {}
    total = cal.get("totalContributions") or 0
    try:
        total_contrib = int(total)
    except Exception:
        total_contrib = 0

    weeks = cal.get("weeks") or []
    counts = []
    for w in weeks:
        for d in (w.get("contributionDays") or []):
            try:
                counts.append(int(d.get("contributionCount") or 0))
            except Exception:
                counts.append(0)

    longest = 0
    run = 0
    for c in counts:
        if c > 0:
            run += 1
            if run > longest:
                longest = run
        else:
            run = 0

    current = 0
    for c in reversed(counts):
        if c > 0:
            current += 1
        else:
            break

    return total_contrib, longest, current


def persist_profile_data(profile_data):
    out_dir = "data"
    if not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "profile_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(profile_data, f, ensure_ascii=False, indent=2)
    return profile_data


def fetch_profile_data():
    token = (os.getenv("GITHUB_TOKEN") or "").strip()
    username = (os.getenv("GITHUB_USERNAME") or "").strip()
    if not token or not username:
        raise EnvironmentError("GITHUB_TOKEN and GITHUB_USERNAME environment variables are required.")

    profile_data = {
        "fetcher_status": "success",
        "username": username,
        "name": "",
        "bio": "",
        "avatar": "",
        "followers": 0,
        "following": 0,
        "account_age_days": 0,
        "total_contributions_365": 0,
        "longest_streak": 0,
        "current_streak": 0,
        "pinned_repos": [],
        "repositories": [],
    }

    basic = fetch_basic_profile(token, username)
    if isinstance(basic, dict):
        profile_data["name"] = basic.get("name") or ""
        profile_data["bio"] = basic.get("bio") or ""
        profile_data["avatar"] = basic.get("avatar_url") or ""
        try:
            profile_data["followers"] = int(basic.get("followers") or 0)
        except Exception:
            profile_data["followers"] = 0
        try:
            profile_data["following"] = int(basic.get("following") or 0)
        except Exception:
            profile_data["following"] = 0
        created_at = parse_iso_datetime(basic.get("created_at"))
        if created_at:
            profile_data["account_age_days"] = max(0, (utcnow() - created_at).days)
    else:
        profile_data["fetcher_status"] = "partial"

    profile_data["pinned_repos"] = fetch_pinned_repos(token, username)
    total_c, longest, current = fetch_contribution_graph(token, username)
    profile_data["total_contributions_365"] = total_c
    profile_data["longest_streak"] = longest
    profile_data["current_streak"] = current

    repos = fetch_all_public_repos(token, username)
    print("Fetching repos... done. Total: " + str(len(repos)))

    if not repos:
        profile_data["fetcher_status"] = "partial"
        profile_data["repositories"] = []
        return persist_profile_data(profile_data)

    repo_entries = []
    for r in repos:
        pushed = parse_iso_datetime(r.get("pushed_at"))
        repo_entries.append({
            "name": r.get("name") or "",
            "description": r.get("description") or "",
            "language": r.get("language") or "",
            "stars": int(r.get("stargazers_count") or 0),
            "forks": int(r.get("forks_count") or 0),
            "topics": r.get("topics") or [],
            "last_pushed_days_ago": days_ago(pushed),
            "is_fork": bool(r.get("fork")),
            "size_kb": int(r.get("size") or 0),
            "readme": "",
            "commits_last_12_months": 0,
        })

    total_repos = len(repo_entries)
    print("Fetching READMEs... 0/" + str(total_repos) + " done.")

    failed_any = False
    done_count = 0
    for repo_entry in repo_entries:
        repo_name = repo_entry["name"]

        try:
            repo_entry["readme"] = fetch_repo_readme(token, username, repo_name)
        except Exception:
            repo_entry["readme"] = ""
            failed_any = True

        # topics
        try:
            repo_url = GITHUB_API_REST_BASE + "/repos/" + quote(username) + "/" + quote(repo_name)
            resp_json = rest_get_json(repo_url, token, params=None)
            if isinstance(resp_json, dict):
                topics = resp_json.get("topics") or []
                if isinstance(topics, list):
                    repo_entry["topics"] = topics
        except Exception:
            failed_any = True

        # commits last 12 months
        try:
            repo_entry["commits_last_12_months"] = fetch_commit_count_last_12_months(token, username, repo_name)
        except Exception:
            repo_entry["commits_last_12_months"] = 0
            failed_any = True

        done_count += 1
        print("Fetching READMEs... " + str(done_count) + "/" + str(total_repos) + " done.")

    profile_data["repositories"] = repo_entries
    if failed_any:
        profile_data["fetcher_status"] = "partial"

    return persist_profile_data(profile_data)


if __name__ == "__main__":
    fetch_profile_data()
