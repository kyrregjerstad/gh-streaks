import { expect, describe, test, beforeEach } from 'bun:test';
import { GitHubService } from '../github.service';
import { format } from 'date-fns';

declare const Bun: {
  nanoseconds(): number;
  env: {
    GITHUB_TOKEN?: string;
  };
};

// Mock data for benchmarks
const mockContributions: Record<string, number> = {
  '2024-01-01': 5,
  '2024-01-02': 3,
  '2024-01-03': 0,
  '2024-01-04': 7,
  '2024-01-05': 2,
};

// Add 100 days of random contributions
for (let i = 0; i < 100; i++) {
  const date = new Date(2024, 0, 6 + i);
  mockContributions[format(date, 'yyyy-MM-dd')] = Math.floor(Math.random() * 10);
}

// Benchmark helper
function benchmark<T>(name: string, fn: () => T): T {
  const start = Bun.nanoseconds();
  const result = fn();
  const end = Bun.nanoseconds();
  console.log(`${name}: ${((end - start) / 1_000_000).toFixed(3)}ms`);
  return result;
}

describe('GitHubService Performance', () => {
  let service: GitHubService;
  let mockDate: Date;

  beforeEach(() => {
    mockDate = new Date('2024-02-03T12:00:00Z');
    service = new GitHubService('mock_token');
  });

  test('should benchmark streak calculations', () => {
    // Benchmark individual components
    benchmark('findLastCommitDate', () => {
      for (let i = 0; i < 1000; i++) {
        service['findLastCommitDate'](
          Object.entries(mockContributions) as [string, number][],
          service['getLocalDateString'](mockDate)
        );
      }
    });

    benchmark('calculateCurrentStreak', () => {
      const dates = Object.entries(mockContributions) as [string, number][];
      const todayStr = service['getLocalDateString'](mockDate);
      const yesterdayStr = service['getLocalDateString'](
        new Date(mockDate.getTime() - 24 * 60 * 60 * 1000)
      );

      for (let i = 0; i < 1000; i++) {
        service['calculateCurrentStreak'](dates, todayStr, yesterdayStr);
      }
    });

    benchmark('calculateLongestStreak', () => {
      const dates = Object.entries(mockContributions) as [string, number][];
      for (let i = 0; i < 1000; i++) {
        service['calculateLongestStreak'](dates, service['getLocalDateString'](mockDate));
      }
    });

    benchmark('calculateTotalCommits', () => {
      for (let i = 0; i < 1000; i++) {
        service['calculateTotalCommits'](
          mockContributions,
          service['getLocalDateString'](mockDate)
        );
      }
    });

    // Benchmark full streak calculation
    benchmark('calculateStreaks (full)', () => {
      for (let i = 0; i < 1000; i++) {
        service['calculateStreaks'](mockContributions, mockDate);
      }
    });
  });

  test('should benchmark data collection', async () => {
    // Mock GraphQL responses
    const mockResponse = {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 100,
            weeks: Array.from({ length: 52 }).map(() => ({
              contributionDays: Array.from({ length: 7 }).map((_, i) => ({
                date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                contributionCount: Math.floor(Math.random() * 10),
              })),
            })),
          },
        },
      },
    };

    // @ts-ignore - mock the private graphql property
    service.graphql = () => Promise.resolve(mockResponse);

    const start = Bun.nanoseconds();
    await service['collectContributions']('testuser', [2024], mockDate);
    const end = Bun.nanoseconds();

    console.log(`Data collection (mocked): ${((end - start) / 1_000_000).toFixed(3)}ms`);
  });

  test('should benchmark real GraphQL query', async () => {
    // Create service with real token
    const token = Bun.env.GITHUB_TOKEN;
    if (!token) {
      console.warn('Skipping real GraphQL benchmark - no GITHUB_TOKEN provided');
      return;
    }

    const realService = new GitHubService(token);

    // Measure single year query
    console.log('\nSingle year query:');
    const startSingle = Bun.nanoseconds();
    const singleYearResult = await realService['getContributionsForYear']('kyrre', 2024);
    const endSingle = Bun.nanoseconds();
    console.log(`Query time: ${((endSingle - startSingle) / 1_000_000).toFixed(3)}ms`);
    console.log(
      `Total contributions: ${singleYearResult.user.contributionsCollection.contributionCalendar.totalContributions}`
    );

    // Measure full history query
    console.log('\nFull history query:');
    const startFull = Bun.nanoseconds();
    const fullResult = await realService.getCommitHistory('kyrre');
    const endFull = Bun.nanoseconds();
    console.log(`Query time: ${((endFull - startFull) / 1_000_000).toFixed(3)}ms`);
    console.log('Results:', fullResult);
  });
});
