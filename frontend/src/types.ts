export type Tier = "Ghost" | "Lurker" | "Builder" | "Operator" | "Rockstar";

export interface Dimension {
  name: string;
  score: number;
  text: string;
}

export interface RepoCard {
  name: string;
  reason: string;
}

export interface AuditResult {
  score: number;
  tier: Tier;
  username: string;
  name: string;
  summary: string;
  dimensions: Dimension[];
  skills: string[];
  redFlags: string[];
  quickWins: string[];
  topRepos: RepoCard[];
}
