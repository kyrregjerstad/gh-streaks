import { graphql } from '@octokit/graphql';
import { format, isFuture, isWithinInterval, parseISO, subDays } from 'date-fns';

interface ContributionResponse {
  user: {
    createdAt: string;
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: Array<{
          contributionDays: Array<{
            contributionCount: number;
            date: string;
          }>;
        }>;
      };
      contributionYears: number[];
      restrictedContributionsCount: number;
      hasAnyRestrictedContributions: boolean;
    };
    anyContributions: {
      hasAnyContributions: boolean;
      restrictedContributionsCount: number;
    };
  };
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalCommits: number;
  lastCommitDate: string | null;
}

export class GitHubService {
  private graphql;

  constructor(token?: string) {
    this.graphql = graphql.defaults({
      headers: {
        authorization: token ? `bearer ${token}` : '',
      },
    });
  }

  private async validateToken() {
    try {
      interface ViewerResponse {
        viewer: {
          login: string;
        };
      }

      const { viewer } = await this.graphql<ViewerResponse>(`
        query {
          viewer {
            login
          }
        }
      `);
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

  private async getContributionsForYear(username: string, year: number) {
    // Get local timezone offset in minutes
    const tzOffset = new Date().getTimezoneOffset();
    // Adjust dates for timezone
    const start = new Date(year, 0, 1, 0, -tzOffset);
    const end = new Date(year, 11, 31, 23, 59 - tzOffset);

    const response = await this.graphql<ContributionResponse>(
      `
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
    `,
      {
        username,
        from: start.toISOString(),
        to: end.toISOString(),
      }
    );

    // Find and log the week containing January 29th
    const calendar = response.user.contributionsCollection.contributionCalendar;
    calendar.weeks.forEach((week) => {
      const hasJan29 = week.contributionDays.some((day) =>
        day.date.includes('2025-01-29')
      );
      if (hasJan29) {
        console.log('\n🔍 Detailed view of week containing January 29th:');
        console.log('===========================================');
        console.log('Local timezone offset:', -tzOffset, 'minutes');
        week.contributionDays.forEach((day) => {
          const date = parseISO(day.date);
          // Adjust the date for local timezone
          const localDate = new Date(date.getTime() - tzOffset * 60000);
          console.log(`📅 ${format(localDate, 'EEEE, MMMM do')}`);
          console.log(`   UTC Date: ${day.date}`);
          console.log(`   Local Date: ${format(localDate, 'yyyy-MM-dd')}`);
          console.log(`   Contributions: ${day.contributionCount}`);
          console.log('   ---');
        });
        console.log('===========================================');
      }
    });

    return calendar;
  }

  async getCommitHistory(username: string): Promise<StreakStats> {
    try {
      // Validate token first
      await this.validateToken();

      // First, get user info and contribution years
      const { user } = await this.graphql<ContributionResponse>(
        `
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
      `,
        { username }
      );

      // Check for restricted contributions
      const hasRestrictedContributions =
        user.contributionsCollection.hasAnyRestrictedContributions;
      const restrictedCount = user.contributionsCollection.restrictedContributionsCount;

      if (hasRestrictedContributions) {
        console.log('\n⚠️ Private Contribution Notice:');
        console.log(`This user has ${restrictedCount} private contributions.`);
        if (restrictedCount > 0) {
          console.log(
            'All private contributions are now visible with the current token.'
          );
        }
      }

      console.log('User created at:', user.createdAt);
      const years = user.contributionsCollection.contributionYears;
      console.log('Contribution years:', years);

      // Get all contributions from each year
      const contributions = new Map<string, number>();
      const today = new Date();
      const tzOffset = today.getTimezoneOffset();
      const todayStr = format(new Date(today.getTime() - tzOffset * 60000), 'yyyy-MM-dd');
      const yesterdayStr = format(
        new Date(today.getTime() - tzOffset * 60000 - 24 * 60 * 60 * 1000),
        'yyyy-MM-dd'
      );

      // Find the earliest year (including checking for backdated commits)
      const userCreatedYear = parseInt(user.createdAt.split('-')[0]);
      const firstContributionYear = Math.min(...years);
      const startYear = Math.min(userCreatedYear, firstContributionYear);

      // Get contributions for all years from start to current
      const yearsToFetch = Array.from(
        { length: today.getFullYear() - startYear + 1 },
        (_, i) => startYear + i
      );

      console.log('Fetching contributions for years:', yearsToFetch);

      // Fetch all years
      for (const year of yearsToFetch) {
        const calendar = await this.getContributionsForYear(username, year);
        calendar.weeks.forEach((week) => {
          week.contributionDays.forEach((day) => {
            const date = parseISO(day.date);
            // Only include dates up to today
            if (!isFuture(date) && format(date, 'yyyy-MM-dd') <= todayStr) {
              contributions.set(day.date, day.contributionCount);
            }
          });
        });
      }

      // Convert to array and sort by date
      const sortedDates = Array.from(contributions.entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      );

      let currentStreak = 0;
      let longestStreak = 0;
      let lastCommitDate: string | null = null;
      let tempStreak = 0;

      for (let i = sortedDates.length - 1; i >= 0; i--) {
        const [date, count] = sortedDates[i];

        // Handle current streak
        if (i === sortedDates.length - 1) {
          // If it's today with no contributions, check yesterday
          if (date === todayStr && count === 0) {
            const yesterdayCount = contributions.get(yesterdayStr) || 0;
            if (yesterdayCount === 0) {
              break;
            }
          }
        }

        if (count > 0) {
          currentStreak++;
          tempStreak++;
        } else {
          // Break current streak if it's not today
          if (date !== todayStr) {
            break;
          }
        }
        console.log('----------------------------------------');

        // Update longest streak
        longestStreak = Math.max(longestStreak, tempStreak);
      }

      // Reset longest streak calculation for reverse pass
      tempStreak = 0;

      // Calculate streaks (forward pass)
      for (const [date, count] of sortedDates) {
        if (count > 0) {
          tempStreak++;
          // Update both streaks
          longestStreak = Math.max(longestStreak, tempStreak);
          // Only update current streak if we're in the most recent streak
          if (
            isWithinInterval(parseISO(date), {
              start: subDays(today, currentStreak),
              end: today,
            })
          ) {
            currentStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
      }

      return {
        currentStreak,
        longestStreak,
        totalCommits: Array.from(contributions.values()).reduce((a, b) => a + b, 0),
        lastCommitDate,
      };
    } catch (error) {
      console.error('Error fetching commit history:', error);
      throw error;
    }
  }
}
