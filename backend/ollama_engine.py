"""
Ollama analysis engine for GitAudit.

Input:
  data/profile_data.json

Output:
  data/ai_analysis.json

Environment:
  OLLAMA_BASE_URL (default: http://localhost:11434)
  OLLAMA_MODEL (default: llama3)

Batching:
  Analyze repositories in batches of 5.

The system prompt is hardcoded and injected into every Ollama call.
Ollama is instructed to return ONLY valid JSON (no markdown).
"""

import json
import os

import requests

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "llama3"
BATCH_SIZE = 5

SYSTEM_PROMPT = (
    "You are a senior software engineering recruiter and GitHub profile expert.\n"
    "Analyze the provided GitHub developer profile and repositories. "
    "You must respond in pure, valid JSON ONLY. No markdown, no HTML, no explanation, no backticks (```).\n\n"
    "Your response MUST exactly follow this JSON schema:\n"
    "{\n"
    "  \"profile_summary\": \"A concise 2-sentence summary of the developer's strengths, weaknesses, and background (specifically tailored for recruiters).\",\n"
    "  \"strongest_repos\": [\n"
    "    {\n"
    "      \"name\": \"Name of one of the strongest/flagship repositories (must match exactly the name of one of the repositories provided in the input payload)\",\n"
    "      \"reason\": \"A recruiter-appealing explanation of why this repo stands out, focusing on code quality, design patterns, or real-world utility.\"\n"
    "    }\n"
    "  ],\n"
    "  \"skill_tags\": [\"Skill1\", \"Skill2\", \"Skill3\"],\n"
    "  \"red_flags\": [\"Red flag 1 detailing a profile/repo weakness\", \"Red flag 2\"],\n"
    "  \"quick_wins\": [\"Actionable recommendation 1 to improve profile\", \"Actionable recommendation 2\"],\n"
    "  \"repositories\": {\n"
    "    \"repository_name_1\": {\n"
    "      \"readme_quality_score\": 7,\n"
    "      \"project_clarity_score\": 8,\n"
    "      \"assessment\": \"Brief evaluation of the repository's code, structure, and documentation.\"\n"
    "    }\n"
    "  }\n"
    "}\n\n"
    "Important rules:\n"
    "1. Replace the keys in the 'repositories' object with the actual names of the repositories provided in the input payload. Include every repository from the input in the 'repositories' dictionary.\n"
    "2. All scores ('readme_quality_score' and 'project_clarity_score') MUST be integers from 0 to 10.\n"
    "3. Keep the JSON well-formatted, completely escape any quotes inside strings, and output ONLY valid JSON."
)


def get_env(name, default_value):
    v = os.getenv(name)
    if v is None or not str(v).strip():
        return default_value
    return str(v).strip()


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def safe_json_parse(text):
    if not isinstance(text, str):
        return None
    text = text.strip()
    
    # Try parsing directly
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # Strip markdown code blocks (```json ... ``` or ``` ... ```)
    if "```" in text:
        import re
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(1).strip())
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

    # Fallback: find the first '{' and the last '}'
    try:
        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            candidate = text[first_brace:last_brace+1]
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
    except Exception:
        pass

    return None


def ollama_chat(base_url, model, system_prompt, user_payload, save_debug=False):
    # Determine if we use OpenAI-compatible completions endpoint or native Ollama chat
    is_openai_format = "/v1" in base_url
    if is_openai_format:
        url = base_url.rstrip("/") + "/chat/completions"
    else:
        url = base_url.rstrip("/") + "/api/chat"

    headers = {
        "Content-Type": "application/json"
    }

    # Add Authorization token if OLLAMA_API_KEY is defined
    api_key = get_env("OLLAMA_API_KEY", "")
    if api_key:
        headers["Authorization"] = "Bearer " + api_key

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "stream": False,
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=180)
    if not (200 <= resp.status_code < 300):
        return None

    try:
        body = resp.json() or {}
    except Exception as e:
        print(f"DEBUG failed to parse json response: {e}")
        return None

    print(f"DEBUG LLM Raw Response keys: {list(body.keys())}")
    
    # Parse message content dynamically supporting both OpenAI and native formats
    content = None
    if "choices" in body:
        choices = body.get("choices")
        if isinstance(choices, list) and len(choices) > 0:
            msg = choices[0].get("message") or {}
            content = msg.get("content")
    else:
        msg = body.get("message") or {}
        content = msg.get("content")

    if not isinstance(content, str):
        print("DEBUG content is not a string!")
        return None

    parsed = safe_json_parse(content)
    if parsed is None:
        print(f"DEBUG safe_json_parse failed for content: {repr(content)}")
    else:
        print(f"DEBUG safe_json_parse succeeded: keys {list(parsed.keys())}")

    # Write the raw Ollama response for the first batch to data/ollama_debug.json for inspection
    if save_debug:
        try:
            os.makedirs("data", exist_ok=True)
            debug_info = {
                "raw_response_body": body,
                "raw_content_string": content,
                "parsed_json": parsed
            }
            with open(os.path.join("data", "ollama_debug.json"), "w", encoding="utf-8") as df:
                json.dump(debug_info, df, ensure_ascii=False, indent=2)
            print("DEBUG wrote data/ollama_debug.json successfully")
        except Exception as ex:
            print(f"DEBUG failed to write data/ollama_debug.json: {ex}")

    return parsed


def build_llm_input(profile_data, batch_repos):
    # Verify profile-level fields are fully populated and sent in every batch.
    # If any fields are missing, we fallback to defaults to prevent context loss.
    profile_subset = {
        "username": profile_data.get("username") or "unknown",
        "name": profile_data.get("name") or "",
        "bio": profile_data.get("bio") or "",
        "followers": profile_data.get("followers") or 0,
        "following": profile_data.get("following") or 0,
        "account_age_days": profile_data.get("account_age_days") or 0,
        "total_contributions_365": profile_data.get("total_contributions_365") or 0,
        "longest_streak": profile_data.get("longest_streak") or 0,
        "current_streak": profile_data.get("current_streak") or 0,
        "pinned_repos": profile_data.get("pinned_repos") or [],
    }

    repos_subset = []
    for r in batch_repos:
        readme_content = r.get("readme") or ""
        # READMEs can be very long. Truncate README content to 1500 characters
        # if it exceeds 1500 chars to avoid exceeding LLM context limits, token bloat,
        # and request timeouts.
        if len(readme_content) > 1500:
            readme_content = readme_content[:1500] + "... [TRUNCATED]"

        repos_subset.append(
            {
                "name": r.get("name"),
                "description": r.get("description"),
                "language": r.get("language"),
                "stars": r.get("stars"),
                "forks": r.get("forks"),
                "topics": r.get("topics"),
                "last_pushed_days_ago": r.get("last_pushed_days_ago"),
                "is_fork": r.get("is_fork"),
                "size_kb": r.get("size_kb"),
                "readme": readme_content,
                "commits_last_12_months": r.get("commits_last_12_months"),
            }
        )

    return {"profile": profile_subset, "repos": repos_subset}


def analyze_profile():
    ollama_base_url = get_env("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL)
    ollama_model = get_env("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)

    input_path = os.path.join("data", "profile_data.json")
    output_path = os.path.join("data", "ai_analysis.json")

    profile_data = load_json(input_path)
    repos = profile_data.get("repositories") or []

    # Prepare aggregated output. Repo analyses are keyed by repo name.
    aggregated = {
        "profile_summary": "",
        "strongest_repos": [],
        "skill_tags": [],
        "red_flags": [],
        "quick_wins": [],
        "repositories": {},
    }

    if not isinstance(repos, list) or len(repos) == 0:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(aggregated, f, ensure_ascii=False, indent=2)
        return aggregated

    # Create batches
    batches = []
    i = 0
    while i < len(repos):
        batches.append(repos[i : i + BATCH_SIZE])
        i += BATCH_SIZE

    for batch_idx in range(len(batches)):
        print(
            "Analyzing batch "
            + str(batch_idx + 1)
            + "/"
            + str(len(batches))
            + "... done."
        )

        batch_repos = batches[batch_idx]
        llm_input = build_llm_input(profile_data, batch_repos)
        analysis = ollama_chat(
            base_url=ollama_base_url,
            model=ollama_model,
            system_prompt=SYSTEM_PROMPT,
            user_payload=llm_input,
            save_debug=(batch_idx == 0)
        )

        if not isinstance(analysis, dict):
            # Mark all repos in this batch as failed.
            for r in batch_repos:
                name = r.get("name")
                if name:
                    aggregated["repositories"][name] = {"analysis_failed": True}
            continue

        # Profile-level fields (best-effort)
        if isinstance(analysis.get("profile_summary"), str) and not aggregated["profile_summary"]:
            aggregated["profile_summary"] = analysis.get("profile_summary") or ""

        if isinstance(analysis.get("strongest_repos"), list) and not aggregated["strongest_repos"]:
            aggregated["strongest_repos"] = analysis.get("strongest_repos") or []

        if isinstance(analysis.get("skill_tags"), list) and not aggregated["skill_tags"]:
            aggregated["skill_tags"] = analysis.get("skill_tags") or []

        if isinstance(analysis.get("red_flags"), list) and not aggregated["red_flags"]:
            aggregated["red_flags"] = analysis.get("red_flags") or []

        if isinstance(analysis.get("quick_wins"), list) and not aggregated["quick_wins"]:
            aggregated["quick_wins"] = analysis.get("quick_wins") or []

        # Repo-level fields: support either "repo_analyses" or "repositories"
        repo_analyses = analysis.get("repo_analyses")
        if repo_analyses is None:
            repo_analyses = analysis.get("repositories")

        if isinstance(repo_analyses, dict):
            for repo_name, repo_result in repo_analyses.items():
                if not isinstance(repo_name, str):
                    continue
                if not isinstance(repo_result, dict):
                    repo_result = {"analysis_failed": True}
                aggregated["repositories"][repo_name] = repo_result
        else:
            for r in batch_repos:
                name = r.get("name")
                if name:
                    aggregated["repositories"][name] = {"analysis_failed": True}

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(aggregated, f, ensure_ascii=False, indent=2)

    return aggregated


fetch_and_analyze_profile = analyze_profile


if __name__ == "__main__":
    analyze_profile()
