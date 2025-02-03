import { expect, test, describe, beforeEach } from 'bun:test';
import { GitHubService } from '../github.service';

// Mock the GraphQL responses
const mockGraphQLResponse = {
  user: {
    createdAt: '2022-01-27T13:58:24Z',
    contributionsCollection: {
      contributionYears: [2024],
      contributionCalendar: {
        totalContributions: 100,
        weeks: [
          {
            contributionDays: [
              // Sunday Jan 28
              { date: '2024-01-28', contributionCount: 5 },
              // Monday Jan 29
              { date: '2024-01-29', contributionCount: 3 },
              // Tuesday Jan 30
              { date: '2024-01-30', contributionCount: 7 },
              // Wednesday Jan 31
              { date: '2024-01-31', contributionCount: 4 },
              // Thursday Feb 1
              { date: '2024-02-01', contributionCount: 2 },
              // Friday Feb 2 (yesterday)
              { date: '2024-02-02', contributionCount: 6 },
              // Saturday Feb 3 (today)
              { date: '2024-02-03', contributionCount: 8 },
            ],
          },
        ],
      },
    },
  },
};

describe('GitHubService', () => {
  let service: GitHubService;
  let mockDate: Date;

  beforeEach(() => {
    // Mock the current date to be February 3, 2024
    mockDate = new Date('2024-02-03T12:00:00Z');
    globalThis.Date = class extends Date {
      constructor(date?: string | number | Date) {
        if (date) {
          super(date);
        } else {
          super(mockDate);
        }
      }
    } as DateConstructor;

    // Create service with mocked GraphQL client
    service = new GitHubService('mock_token');
    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(mockGraphQLResponse);
  });

  test('should handle empty contributions', async () => {
    const emptyResponse = {
      user: {
        createdAt: '2022-01-27T13:58:24Z',
        contributionsCollection: {
          contributionYears: [2024],
          contributionCalendar: {
            totalContributions: 0,
            weeks: [
              {
                contributionDays: [
                  { date: '2024-02-03', contributionCount: 0 }, // today
                ],
              },
            ],
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(emptyResponse);
    const stats = await service.getCommitHistory('testuser');

    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.totalCommits).toBe(0);
    expect(stats.lastCommitDate).toBeNull();
  });

  test('should handle single day contribution', async () => {
    const singleDayResponse = {
      user: {
        createdAt: '2022-01-27T13:58:24Z',
        contributionsCollection: {
          contributionYears: [2024],
          contributionCalendar: {
            totalContributions: 5,
            weeks: [
              {
                contributionDays: [
                  { date: '2024-02-03', contributionCount: 5 }, // today
                ],
              },
            ],
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(singleDayResponse);
    const stats = await service.getCommitHistory('testuser');

    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.totalCommits).toBe(5);
    expect(stats.lastCommitDate).toBe('2024-02-03');
  });

  test('should handle future contributions', async () => {
    const futureResponse = {
      user: {
        createdAt: '2022-01-27T13:58:24Z',
        contributionsCollection: {
          contributionYears: [2024],
          contributionCalendar: {
            totalContributions: 3,
            weeks: [
              {
                contributionDays: [
                  { date: '2024-02-02', contributionCount: 1 }, // yesterday
                  { date: '2024-02-03', contributionCount: 1 }, // today
                  { date: '2024-02-04', contributionCount: 1 }, // tomorrow (should be ignored)
                ],
              },
            ],
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(futureResponse);
    const stats = await service.getCommitHistory('testuser');

    expect(stats.currentStreak).toBe(2); // only count up to today
    expect(stats.longestStreak).toBe(2);
    expect(stats.totalCommits).toBe(2); // future commits should be ignored
    expect(stats.lastCommitDate).toBe('2024-02-03');
  });

  test('should handle streak with gap', async () => {
    const gapResponse = {
      user: {
        createdAt: '2022-01-27T13:58:24Z',
        contributionsCollection: {
          contributionYears: [2024],
          contributionCalendar: {
            totalContributions: 4,
            weeks: [
              {
                contributionDays: [
                  { date: '2024-01-30', contributionCount: 1 },
                  { date: '2024-01-31', contributionCount: 1 },
                  { date: '2024-02-01', contributionCount: 0 }, // gap
                  { date: '2024-02-02', contributionCount: 1 },
                  { date: '2024-02-03', contributionCount: 1 }, // today
                ],
              },
            ],
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(gapResponse);
    const stats = await service.getCommitHistory('testuser');

    expect(stats.currentStreak).toBe(2); // only count after the gap
    expect(stats.longestStreak).toBe(2); // both streaks are 2 days
    expect(stats.totalCommits).toBe(4);
    expect(stats.lastCommitDate).toBe('2024-02-03');
  });

  test('should handle long past streak', async () => {
    const pastStreakResponse = {
      user: {
        createdAt: '2022-01-27T13:58:24Z',
        contributionsCollection: {
          contributionYears: [2024],
          contributionCalendar: {
            totalContributions: 7,
            weeks: [
              {
                contributionDays: [
                  { date: '2024-01-25', contributionCount: 1 },
                  { date: '2024-01-26', contributionCount: 1 },
                  { date: '2024-01-27', contributionCount: 1 },
                  { date: '2024-01-28', contributionCount: 1 },
                  { date: '2024-01-29', contributionCount: 1 }, // 5 day streak
                  { date: '2024-01-30', contributionCount: 0 }, // gap
                  { date: '2024-01-31', contributionCount: 0 },
                  { date: '2024-02-01', contributionCount: 0 },
                  { date: '2024-02-02', contributionCount: 1 },
                  { date: '2024-02-03', contributionCount: 1 }, // current 2 day streak
                ],
              },
            ],
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(pastStreakResponse);
    const stats = await service.getCommitHistory('testuser');

    expect(stats.currentStreak).toBe(2);
    expect(stats.longestStreak).toBe(5); // the past streak was longer
    expect(stats.totalCommits).toBe(7);
    expect(stats.lastCommitDate).toBe('2024-02-03');
  });

  test('should calculate current streak correctly with active streak', async () => {
    const stats = await service.getCommitHistory('testuser');
    expect(stats.currentStreak).toBe(7);
    expect(stats.longestStreak).toBe(7);
    expect(stats.totalCommits).toBe(35);
    expect(stats.lastCommitDate).toBe('2024-02-03');
  });

  test('should handle no contributions today but active streak', async () => {
    const noContributionToday = {
      ...mockGraphQLResponse,
      user: {
        ...mockGraphQLResponse.user,
        contributionsCollection: {
          ...mockGraphQLResponse.user.contributionsCollection,
          contributionCalendar: {
            ...mockGraphQLResponse.user.contributionsCollection.contributionCalendar,
            weeks: [
              {
                contributionDays: [
                  { date: '2024-01-28', contributionCount: 5 },
                  { date: '2024-01-29', contributionCount: 3 },
                  { date: '2024-01-30', contributionCount: 7 },
                  { date: '2024-01-31', contributionCount: 4 },
                  { date: '2024-02-01', contributionCount: 2 },
                  { date: '2024-02-02', contributionCount: 6 }, // yesterday
                  { date: '2024-02-03', contributionCount: 0 }, // today
                ],
              },
            ],
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(noContributionToday);
    const stats = await service.getCommitHistory('testuser');

    // Streak should still be active since we contributed yesterday
    expect(stats.currentStreak).toBe(6);
    expect(stats.lastCommitDate).toBe('2024-02-02');
  });

  test('should handle break in streak', async () => {
    const brokenStreak = {
      ...mockGraphQLResponse,
      user: {
        ...mockGraphQLResponse.user,
        contributionsCollection: {
          ...mockGraphQLResponse.user.contributionsCollection,
          contributionCalendar: {
            ...mockGraphQLResponse.user.contributionsCollection.contributionCalendar,
            weeks: [
              {
                contributionDays: [
                  { date: '2024-01-28', contributionCount: 5 },
                  { date: '2024-01-29', contributionCount: 3 },
                  { date: '2024-01-30', contributionCount: 7 },
                  { date: '2024-01-31', contributionCount: 0 }, // break
                  { date: '2024-02-01', contributionCount: 2 },
                  { date: '2024-02-02', contributionCount: 6 },
                  { date: '2024-02-03', contributionCount: 8 },
                ],
              },
            ],
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(brokenStreak);
    const stats = await service.getCommitHistory('testuser');

    // Current streak should be 3 (Feb 1-3)
    expect(stats.currentStreak).toBe(3);
    // Longest streak should be 3 (Jan 28-30 or Feb 1-3)
    expect(stats.longestStreak).toBe(3);
  });
});
