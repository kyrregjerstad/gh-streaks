import { graphql } from '@octokit/graphql';
import { format, isFuture, parseISO } from 'date-fns';
import {
  ContributionMap,
  ContributionResponse,
  DateRange,
  StreakStats,
  UserInfo,
} from './types';

export class GitHubService {
  private graphql;
  private tzOffset: number;

  constructor(token?: string) {
    this.graphql = graphql.defaults({
      headers: {
        authorization: token ? `bearer ${token}` : '',
      },
    });
    this.tzOffset = new Date().getTimezoneOffset();
  }

  /**
   * Fetches contributions for a specific year
   */
  private async getContributionsForYear(
    username: string,
    year: number
  ): Promise<ContributionResponse> {
    const query = `query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
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
    }`;

    const from = new Date(year, 0, 1); // January 1st
    const to = new Date(year, 11, 31); // December 31st

    const response = await this.graphql<ContributionResponse>(query, {
      username,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    return response;
  }

  /**
   * Converts a date to local date string format
   */
  private getLocalDateString(date: Date): string {
    return format(new Date(date.getTime() - this.tzOffset * 60000), 'yyyy-MM-dd');
  }

  /**
   * Finds the most recent date with contributions
   */
  private findLastCommitDate(dates: [string, number][], todayStr: string): string | null {
    return (
      dates
        .filter(([date]) => date <= todayStr)
        .findLast(([, count]) => count > 0)?.[0] ?? null
    );
  }

  /**
   * Calculates the current streak from today backwards
   */
  private calculateCurrentStreak(
    dates: [string, number][],
    todayStr: string,
    yesterdayStr: string
  ): number {
    // Handle edge case: if today has no contributions, check yesterday
    const lastEntry = dates.at(-1);
    const [lastDate, lastCount] = lastEntry ?? ['', 0];
    const isToday = lastDate === todayStr;
    const hasNoContributions = lastCount === 0;

    if (isToday && hasNoContributions) {
      const hasYesterdayContributions = dates.some(
        ([date, count]) => date === yesterdayStr && count > 0
      );
      if (!hasYesterdayContributions) return 0;
    }

    // Count consecutive days with contributions from most recent
    let streak = 0;
    for (const [date, count] of dates.toReversed()) {
      // Skip future dates
      if (date > todayStr) continue;

      // Skip today if no contributions
      if (date === todayStr && count === 0) continue;

      // Break streak on first day with no contributions
      if (count === 0) break;

      streak++;
    }

    return streak;
  }

  /**
   * Calculates the longest streak in the contribution history
   */
  private calculateLongestStreak(dates: [string, number][], todayStr: string): number {
    let currentStreak = 0;
    let maxStreak = 0;

    for (const [date, count] of dates) {
      // Skip future dates
      if (date > todayStr) continue;

      if (count > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak;
  }

  /**
   * Calculates total number of contributions
   */
  private calculateTotalCommits(
    contributions: ContributionMap,
    todayStr: string
  ): number {
    return Object.entries(contributions)
      .filter(([date]) => date <= todayStr)
      .reduce((sum, [, count]) => sum + count, 0);
  }

  /**
   * Calculates streak statistics from contribution data
   */
  private calculateStreaks(contributions: ContributionMap, today: Date): StreakStats {
    const dates = Object.entries(contributions).sort(([a], [b]) => a.localeCompare(b));
    const todayStr = this.getLocalDateString(today);
    const yesterdayStr = this.getLocalDateString(
      new Date(today.getTime() - 24 * 60 * 60 * 1000)
    );

    return {
      currentStreak: this.calculateCurrentStreak(dates, todayStr, yesterdayStr),
      longestStreak: this.calculateLongestStreak(dates, todayStr),
      totalCommits: this.calculateTotalCommits(contributions, todayStr),
      lastCommitDate: this.findLastCommitDate(dates, todayStr),
    };
  }

  /**
   * Gets the commit history and calculates streak statistics for a user
   */
  async getCommitHistory(username: string): Promise<StreakStats> {
    const now = new Date();
    const currentYear = now.getFullYear();
    let contributions: Record<string, number> = {};
    let hasMoreHistory = true;
    let yearToFetch = currentYear;

    while (hasMoreHistory) {
      // Fetch the year's contributions
      const yearData = await this.getContributionsForYear(username, yearToFetch);
      const yearContributions = this.extractContributionsFromYear(yearData);

      // Merge with existing contributions
      contributions = { ...yearContributions, ...contributions };

      // Check if we need to fetch more history
      const earliestDateInYear = `${yearToFetch}-01-01`;
      const hasContributionsOnJan1 = yearContributions[earliestDateInYear] > 0;

      // Stop conditions:
      // 1. If the longest streak doesn't reach January 1st
      // 2. If we've gone back 5 years (as a safety limit)
      // 3. If January 1st has no contributions (streak is broken)
      const needsMoreHistory = hasContributionsOnJan1 && yearToFetch > currentYear - 5;

      if (!needsMoreHistory) {
        hasMoreHistory = false;
      } else {
        yearToFetch--;
      }
    }

    return this.calculateStreaks(contributions, now);
  }

  private extractContributionsFromYear(yearData: any): Record<string, number> {
    const contributions: Record<string, number> = {};

    for (const week of yearData.user.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        contributions[day.date] = day.contributionCount;
      }
    }

    return contributions;
  }
}
