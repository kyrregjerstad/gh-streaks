export interface ContributionDay {
  date: string;
  contributionCount: number;
}
export interface ContributionWeek {
  contributionDays: ContributionDay[];
}
export interface ContributionCalendar {
  totalContributions: number;
  weeks: ContributionWeek[];
}
export interface ContributionCollection {
  contributionCalendar: ContributionCalendar;
  hasAnyRestrictedContributions: boolean;
  restrictedContributionsCount: number;
}
export interface UserInfo {
  createdAt: string;
  contributionsCollection: ContributionCollection;
}

export interface ContributionResponse {
  user: UserInfo;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ContributionMap {
  [date: string]: number;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalCommits: number;
  lastCommitDate: string | null;
}
