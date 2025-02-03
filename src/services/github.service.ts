import { graphql } from '@octokit/graphql';
import { format, isFuture, parseISO } from 'date-fns';

// Types for GitHub API responses
interface ContributionDay {
  contributionCount: number;
  date: string;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

interface ContributionCalendar {
  totalContributions: number;
  weeks: ContributionWeek[];
}

interface UserContributions {
  contributionCalendar: ContributionCalendar;
  contributionYears: number[];
  restrictedContributionsCount: number;
  hasAnyRestrictedContributions: boolean;
}

interface UserInfo {
  createdAt: string;
  contributionsCollection: UserContributions;
}

interface ContributionResponse {
  user: {
    createdAt: string;
    contributionsCollection: UserContributions;
  };
}

// Types for internal use
interface DateRange {
  start: Date;
  end: Date;
}

interface ContributionMap {
  [date: string]: number;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalCommits: number;
  lastCommitDate: string | null;
}

// GraphQL Queries
const VIEWER_QUERY = `
  query {
    viewer {
      login
    }
  }
`;

const USER_INFO_QUERY = `
  query($username: String!) {
    user(login: $username) {
      createdAt
      contributionsCollection {
        contributionYears
        restrictedContributionsCount
        hasAnyRestrictedContributions
      }
    }
  }
`;

const CONTRIBUTIONS_QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

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
   * Validates the GitHub token and its permissions
   */
  private async validateToken(): Promise<boolean> {
    try {
      await this.graphql(VIEWER_QUERY);
      return true;
    } catch (error) {
      console.warn(
        '⚠️ Token validation failed. Some contributions might not be visible.'
      );
      console.warn('   Make sure your token has the following permissions:');
      console.warn('   - read:user');
      console.warn('   - repo (for private repository contributions)');
      return false;
    }
  }

  /**
   * Gets the date range for a given year, adjusted for timezone
   */
  private getDateRangeForYear(year: number): DateRange {
    return {
      start: new Date(year, 0, 1, 0, -this.tzOffset),
      end: new Date(year, 11, 31, 23, 59 - this.tzOffset),
    };
  }

  /**
   * Fetches contributions for a specific year
   */
  private async getContributionsForYear(
    username: string,
    year: number
  ): Promise<ContributionCalendar> {
    const { start, end } = this.getDateRangeForYear(year);
    const response = await this.graphql<ContributionResponse>(CONTRIBUTIONS_QUERY, {
      username,
      from: start.toISOString(),
      to: end.toISOString(),
    });

    return response.user.contributionsCollection.contributionCalendar;
  }

  /**
   * Fetches user info and validates private contribution access
   */
  private async fetchUserInfo(username: string): Promise<UserInfo> {
    const { user } = await this.graphql<ContributionResponse>(USER_INFO_QUERY, {
      username,
    });

    const { hasAnyRestrictedContributions, restrictedContributionsCount } =
      user.contributionsCollection;

    if (hasAnyRestrictedContributions && restrictedContributionsCount > 0) {
      console.warn('\n⚠️ Private Contribution Notice:');
      console.warn(
        `This user has ${restrictedContributionsCount} private contributions.`
      );
      console.warn('All private contributions are now visible with the current token.');
    }

    return user;
  }

  /**
   * Collects all contributions for the given years
   */
  private async collectContributions(
    username: string,
    years: number[],
    today: Date
  ): Promise<ContributionMap> {
    const contributions: ContributionMap = {};
    const todayStr = this.getLocalDateString(today);

    for (const year of years) {
      const calendar = await this.getContributionsForYear(username, year);
      calendar.weeks.forEach((week) => {
        week.contributionDays.forEach((day) => {
          const date = parseISO(day.date);
          if (!isFuture(date) && format(date, 'yyyy-MM-dd') <= todayStr) {
            contributions[day.date] = day.contributionCount;
          }
        });
      });
    }

    return contributions;
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
  private findLastCommitDate(dates: [string, number][]): string | null {
    return dates.findLast(([, count]) => count > 0)?.[0] ?? null;
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
    if (dates.at(-1)?.[0] === todayStr && dates.at(-1)?.[1] === 0) {
      const hasYesterdayContributions = dates.some(
        ([date, count]) => date === yesterdayStr && count > 0
      );
      if (!hasYesterdayContributions) return 0;
    }

    // Count consecutive days with contributions from most recent
    let streak = 0;
    for (const [date, count] of dates.toReversed()) {
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
  private calculateLongestStreak(dates: [string, number][]): number {
    return dates.reduce(
      ({ currentStreak, maxStreak }, [, count]) => {
        const newStreak = count > 0 ? currentStreak + 1 : 0;
        return {
          currentStreak: newStreak,
          maxStreak: Math.max(maxStreak, newStreak),
        };
      },
      { currentStreak: 0, maxStreak: 0 }
    ).maxStreak;
  }

  /**
   * Calculates total number of contributions
   */
  private calculateTotalCommits(contributions: ContributionMap): number {
    return Object.values(contributions).reduce((sum, count) => sum + count, 0);
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
      longestStreak: this.calculateLongestStreak(dates),
      totalCommits: this.calculateTotalCommits(contributions),
      lastCommitDate: this.findLastCommitDate(dates),
    };
  }

  /**
   * Gets the commit history and calculates streak statistics for a user
   */
  async getCommitHistory(username: string): Promise<StreakStats> {
    try {
      await this.validateToken();

      const user = await this.fetchUserInfo(username);
      const today = new Date();

      // Determine years to fetch
      const userCreatedYear = parseInt(user.createdAt.split('-')[0]);
      const firstContributionYear = Math.min(
        ...user.contributionsCollection.contributionYears
      );
      const startYear = Math.min(userCreatedYear, firstContributionYear);
      const yearsToFetch = Array.from(
        { length: today.getFullYear() - startYear + 1 },
        (_, i) => startYear + i
      );

      const contributions = await this.collectContributions(
        username,
        yearsToFetch,
        today
      );
      return this.calculateStreaks(contributions, today);
    } catch (error) {
      console.error('Error fetching commit history:', error);
      throw error;
    }
  }
}
