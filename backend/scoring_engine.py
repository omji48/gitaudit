"""
GitAudit scoring engine.

Reads:
- data/profile_data.json
- data/ai_analysis.json

Writes:
- data/final_score.json

Pure Python (json/math only). No external scoring libraries.
Never crashes on missing data; missing fields default to 0 / empty values.
"""

import json
import math
import os

INPUT_PROFILE_PATH = os.path.join("data", "profile_data.json")
INPUT_AI_PATH = os.path.join("data", "ai_analysis.json")
OUTPUT_FINAL_PATH = os.path.join("data", "final_score.json")

TIERS = [
    (20, "Ghost", "👻"),
    (40, "Lurker", "🕵️"),
    (60, "Builder", "🧱"),
    (80, "Operator", "⚡"),
    (100, "Rockstar", "🌟"),
]


def _safe_read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _safe_get(d, key, default):
    try:
        if isinstance(d, dict):
            return d.get(key, default)
    except Exception:
        pass
    return default


def _ensure_list(x):
    return x if isinstance(x, list) else []


def _clamp(v, lo, hi):
    try:
        return max(lo, min(hi, v))
    except Exception:
        return lo


def _log1p(x):
    try:
        return math.log1p(float(x))
    except Exception:
        return 0.0


def _dimension_score_from_average(avg):
    return _clamp(avg, 0.0, 100.0)


def _compute_readme_quality(profile_data, ai_analysis):
    """
    readme_quality (0-100) weighted by 25% later.

    Formula:
      - Consider ONLY non-fork repos.
      - For each non-fork repo, use AI repo field `readme_quality_score` in range 0..10.
      - Average across those repos: avg_0_10.
      - Map to 0..100 via avg_0_10 * 10.

    WHY:
      README quality is the strongest signal for onboarding clarity and engineering communication.
    """
    repos = _ensure_list(_safe_get(profile_data, "repositories", []))
    if not repos:
        return 0.0, "0 repos available for scoring"

    ai_repos = _safe_get(ai_analysis, "repositories", {})
    if not isinstance(ai_repos, dict):
        ai_repos = {}

    non_fork = []
    for r in repos:
        if not bool(_safe_get(r, "is_fork", False)):
            non_fork.append(r)

    if not non_fork:
        return 0.0, "No non-fork repos available"

    total = 0.0
    count = 0
    solid = 0

    for r in non_fork:
        name = _safe_get(r, "name", "")
        if not isinstance(name, str) or not name.strip():
            continue

        count += 1
        ai = ai_repos.get(name, {})
        if not isinstance(ai, dict):
            ai = {}

        score = ai.get("readme_quality_score", 0)
        try:
            score_f = float(score)
        except Exception:
            score_f = 0.0

        score_f = _clamp(score_f, 0.0, 10.0)
        total += score_f
        if score_f >= 7.0:
            solid += 1

    avg = (total / count) if count else 0.0
    score_100 = avg * 10.0
    desc = str(solid) + " of " + str(count) + " repos have solid READMEs"
    return _dimension_score_from_average(score_100), desc


def _compute_commit_consistency(profile_data, ai_analysis):
    """
    commit_consistency (0-100) weighted by 20% later.

    Formula:
      - contributions component:
          c_score = min(1, contributions / 500) * 100
      - streak component:
          longest_ratio = min(1, longest_streak / 30)
          current_ratio = min(1, current_streak / 10)
          streak_score = longest_ratio*60 + current_ratio*40
      - final:
          final = 0.65*c_score + 0.35*streak_score
      - small boost:
          if contributions > 500 and longest_streak >= 30, add +5 (cap 100)

    WHY:
      Sustained activity (streak) reduces false positives from one-off bursts.
    """
    contributions = _safe_get(profile_data, "total_contributions_365", 0)
    try:
        contributions = int(contributions)
    except Exception:
        contributions = 0

    longest = _safe_get(ai_analysis, "longest_streak", _safe_get(profile_data, "longest_streak", 0))
    current = _safe_get(ai_analysis, "current_streak", _safe_get(profile_data, "current_streak", 0))
    try:
        longest = int(longest)
    except Exception:
        longest = 0
    try:
        current = int(current)
    except Exception:
        current = 0

    c_score = _clamp((contributions / 500.0) * 100.0, 0.0, 100.0)

    longest_ratio = _clamp(longest / 30.0, 0.0, 1.0)
    current_ratio = _clamp(current / 10.0, 0.0, 1.0)
    streak_score = (longest_ratio * 60.0) + (current_ratio * 40.0)

    final = (0.65 * c_score) + (0.35 * streak_score)

    if contributions > 500 and longest >= 30:
        final = _clamp(final + 5.0, 0.0, 100.0)

    desc = str(contributions) + " contributions last year, longest streak " + str(longest) + " days"
    return _dimension_score_from_average(final), desc


def _compute_project_diversity(profile_data):
    """
    project_diversity (0-100) weighted by 15% later.

    Formula:
      - Distinct languages:
          dl = count unique non-empty `repo.language`
          lang_score = min(1, dl/5) * 60
      - Distinct topic domains (heuristic):
          for each topic string, take the first token before common separators.
          td = count unique domains
          topic_score = min(1, td/8) * 40
      - final = lang_score + topic_score

    WHY:
      Breadth across languages/topics suggests adaptability and a wider toolkit.
    """
    repos = _ensure_list(_safe_get(profile_data, "repositories", []))

    distinct_lang = set()
    topic_domains = set()

    for r in repos:
        lang = _safe_get(r, "language", "")
        if isinstance(lang, str) and lang.strip():
            distinct_lang.add(lang.strip())

        topics = _safe_get(r, "topics", [])
        if isinstance(topics, list):
            for t in topics:
                if not isinstance(t, str):
                    continue
                tt = t.strip().lower()
                if not tt:
                    continue

                token = tt
                for sep in [":", "-", "_", " "]:
                    if sep in token:
                        token = token.split(sep, 1)[0]
                        break
                if token:
                    topic_domains.add(token)

    dl = len(distinct_lang)
    td = len(topic_domains)

    lang_score = _clamp((dl / 5.0) * 60.0, 0.0, 60.0)
    topic_score = _clamp((td / 8.0) * 40.0, 0.0, 40.0)

    final = lang_score + topic_score
    desc = str(dl) + " distinct languages, " + str(td) + " topic domains"
    return _dimension_score_from_average(final), desc


def _compute_profile_completeness(profile_data):
    """
    profile_completeness (0-100) weighted by 15% later.

    Formula:
      - bio_present: 1 if bio non-empty else 0 (20 points)
      - pinned_present: 1 if pinned_repos non-empty else 0 (20 points)
      - description_ratio: fraction of repos with non-empty description (30 points)
      - topics_ratio: fraction of repos with non-empty topics list (30 points)

    WHY:
      Completeness correlates with how intentional someone is about communicating value.
    """
    bio = _safe_get(profile_data, "bio", "")
    bio_present = 1.0 if isinstance(bio, str) and bio.strip() else 0.0

    pinned = _ensure_list(_safe_get(profile_data, "pinned_repos", []))
    pinned_present = 1.0 if len(pinned) > 0 else 0.0

    repos = _ensure_list(_safe_get(profile_data, "repositories", []))
    if not repos:
        return 0.0, "No repositories to assess completeness"

    desc_count = 0
    topics_count = 0

    for r in repos:
        desc = _safe_get(r, "description", "")
        if isinstance(desc, str) and desc.strip():
            desc_count += 1
        topics = _safe_get(r, "topics", [])
        if isinstance(topics, list) and len(topics) > 0:
            topics_count += 1

    desc_ratio = desc_count / float(len(repos))
    topics_ratio = topics_count / float(len(repos))

    final = (bio_present * 20.0) + (pinned_present * 20.0) + (desc_ratio * 30.0) + (topics_ratio * 30.0)

    desc = (
        "bio=" + ("yes" if bio_present == 1.0 else "no")
        + ", pinned=" + ("yes" if pinned_present == 1.0 else "no")
        + "; " + str(desc_count) + "/" + str(len(repos)) + " descriptions, "
        + str(topics_count) + "/" + str(len(repos)) + " topic lists"
    )
    return _dimension_score_from_average(final), desc


def _compute_recruiter_appeal(profile_data, ai_analysis):
    """
    recruiter_appeal (0-100) weighted by 15% later.

    Formula:
      - Average AI `project_clarity` across all repos (0..10).
      - Map avg*10 to 0..100.

    WHY:
      Recruiters decide quickly; clarity is the core "is this worth reading?" signal.
    """
    repos = _ensure_list(_safe_get(profile_data, "repositories", []))
    ai_repos = _safe_get(ai_analysis, "repositories", {})
    if not isinstance(ai_repos, dict):
        ai_repos = {}

    if not repos:
        return 0.0, "No repos to assess recruiter appeal"

    total = 0.0
    count = 0

    for r in repos:
        name = _safe_get(r, "name", "")
        if not isinstance(name, str) or not name.strip():
            continue
        count += 1

        ai = ai_repos.get(name, {})
        if not isinstance(ai, dict):
            ai = {}

        score = ai.get("project_clarity", 0)
        try:
            score_f = float(score)
        except Exception:
            score_f = 0.0

        score_f = _clamp(score_f, 0.0, 10.0)
        total += score_f

    avg = (total / count) if count else 0.0
    final = avg * 10.0
    desc = "Average project clarity across " + str(count) + " repos"
    return _dimension_score_from_average(final), desc


def _compute_community_signal(profile_data):
    """
    community_signal (0-100) weighted by 10% later.

    Formula:
      - followers_component = log1p(followers)
      - stars_component = log1p(stars_total)

      signal = 0.55*followers_component + 0.45*stars_component
      final = min(100, signal * 18)

    WHY:
      Popularity is a proxy for reach, but log scaling prevents high-profile outliers.
    """
    followers = _safe_get(profile_data, "followers", 0)
    try:
        followers = int(followers)
    except Exception:
        followers = 0

    repos = _ensure_list(_safe_get(profile_data, "repositories", []))
    stars_total = 0

    for r in repos:
        try:
            stars_total += int(_safe_get(r, "stars", 0) or 0)
        except Exception:
            pass

    followers_component = _log1p(followers)
    stars_component = _log1p(stars_total)

    signal = (0.55 * followers_component) + (0.45 * stars_component)
    final = min(100.0, signal * 18.0)

    desc = "followers=" + str(followers) + ", total_stars=" + str(stars_total)
    return _dimension_score_from_average(final), desc


def _compute_tier(overall_score):
    for threshold, tier_name, emoji in TIERS:
        if overall_score <= threshold:
            return tier_name, emoji
    return "Rockstar", "🌟"


def score_profile():
    profile_data = _safe_read_json(INPUT_PROFILE_PATH)
    ai_analysis = _safe_read_json(INPUT_AI_PATH)

    repos = _ensure_list(_safe_get(profile_data, "repositories", []))
    username = _safe_get(profile_data, "username", "")
    name = _safe_get(profile_data, "name", "")

    # Dimension scores
    readme_quality, readme_desc = _compute_readme_quality(profile_data, ai_analysis)
    commit_consistency, commit_desc = _compute_commit_consistency(profile_data, ai_analysis)
    project_diversity, diversity_desc = _compute_project_diversity(profile_data)
    profile_completeness, completeness_desc = _compute_profile_completeness(profile_data)
    recruiter_appeal, recruiter_desc = _compute_recruiter_appeal(profile_data, ai_analysis)
    community_signal, community_desc = _compute_community_signal(profile_data)

    dimension_scores = {
        "readme_quality": int(round(readme_quality)),
        "commit_consistency": int(round(commit_consistency)),
        "project_diversity": int(round(project_diversity)),
        "profile_completeness": int(round(profile_completeness)),
        "recruiter_appeal": int(round(recruiter_appeal)),
        "community_signal": int(round(community_signal)),
    }

    # Weighted final score
    weights = {
        "readme_quality": 0.25,
        "commit_consistency": 0.20,
        "project_diversity": 0.15,
        "profile_completeness": 0.15,
        "recruiter_appeal": 0.15,
        "community_signal": 0.10,
    }

    overall = (
        float(dimension_scores["readme_quality"]) * weights["readme_quality"]
        + float(dimension_scores["commit_consistency"]) * weights["commit_consistency"]
        + float(dimension_scores["project_diversity"]) * weights["project_diversity"]
        + float(dimension_scores["profile_completeness"]) * weights["profile_completeness"]
        + float(dimension_scores["recruiter_appeal"]) * weights["recruiter_appeal"]
        + float(dimension_scores["community_signal"]) * weights["community_signal"]
    )

    overall_score = int(round(_clamp(overall, 0.0, 100.0)))
    tier, tier_emoji = _compute_tier(overall_score)

    score_breakdown_text = {
        "readme_quality": readme_desc,
        "commit_consistency": commit_desc,
        "project_diversity": diversity_desc,
        "profile_completeness": completeness_desc,
        "recruiter_appeal": recruiter_desc,
        "community_signal": community_desc,
    }

    final = {
        "overall_score": overall_score,
        "tier": tier,
        "tier_emoji": tier_emoji,
        "dimension_scores": dimension_scores,
        "score_breakdown_text": score_breakdown_text,
        "ai_summary": _safe_get(ai_analysis, "profile_summary", ""),
        "strongest_repos": _safe_get(ai_analysis, "strongest_repos", []),
        "skill_tags": _safe_get(ai_analysis, "skill_tags", []),
        "red_flags": _safe_get(ai_analysis, "red_flags", []),
        "quick_wins": _safe_get(ai_analysis, "quick_wins", []),
        "username": username,
        "name": name,
    }

    os.makedirs(os.path.dirname(OUTPUT_FINAL_PATH), exist_ok=True)
    with open(OUTPUT_FINAL_PATH, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    print("Score: " + str(overall_score) + "/100 — " + tier + " " + tier_emoji)
    return final


if __name__ == "__main__":
    score_profile()
