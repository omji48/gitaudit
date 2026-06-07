import { AuditResult } from './types';

const BASE_URL = 'http://localhost:8000';

export async function runPipeline(username: string, token: string, model: string) {
  const res = await fetch(`${BASE_URL}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, token, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || err?.error || 'Failed to start run. Is the Python backend running on localhost:8000?');
  }
  return res.json();
}

export async function getStatus() {
  const res = await fetch(`${BASE_URL}/api/status`);
  if (!res.ok) {
    throw new Error('Failed to fetch status');
  }
  return res.json();
}

export async function getResults(): Promise<AuditResult> {
  const res = await fetch(`${BASE_URL}/api/results`);
  if (!res.ok) {
    throw new Error('Failed to fetch results');
  }
  const raw = await res.json();
  return {
    score: raw.overall_score ?? 0,
    tier: raw.tier ?? "Ghost",
    username: raw.username ?? "",
    name: raw.name ?? "",
    summary: raw.ai_summary ?? "",
    dimensions: [
      {
        name: "README Quality",
        score: (raw.dimension_scores?.readme_quality ?? 0) / 10,
        text: raw.score_breakdown_text?.readme_quality ?? ""
      },
      {
        name: "Commit Consistency",
        score: (raw.dimension_scores?.commit_consistency ?? 0) / 10,
        text: raw.score_breakdown_text?.commit_consistency ?? ""
      },
      {
        name: "Project Diversity",
        score: (raw.dimension_scores?.project_diversity ?? 0) / 10,
        text: raw.score_breakdown_text?.project_diversity ?? ""
      },
      {
        name: "Profile Completeness",
        score: (raw.dimension_scores?.profile_completeness ?? 0) / 10,
        text: raw.score_breakdown_text?.profile_completeness ?? ""
      },
      {
        name: "Recruiter Appeal",
        score: (raw.dimension_scores?.recruiter_appeal ?? 0) / 10,
        text: raw.score_breakdown_text?.recruiter_appeal ?? ""
      },
      {
        name: "Community Signal",
        score: (raw.dimension_scores?.community_signal ?? 0) / 10,
        text: raw.score_breakdown_text?.community_signal ?? ""
      }
    ],
    skills: raw.skill_tags ?? [],
    redFlags: raw.red_flags ?? [],
    quickWins: raw.quick_wins ?? [],
    topRepos: (raw.strongest_repos ?? []).map((r: any) => ({
      name: r.name ?? "",
      reason: r.reason ?? ""
    }))
  };
}
