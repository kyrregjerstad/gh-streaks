import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { GitHubService } from './services/github.service';
import { BadgeService } from './services/badge.service';

type Bindings = {
  GITHUB_TOKEN: string;
};

type Variables = {
  githubService: GitHubService;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  c.set('githubService', new GitHubService(c.env.GITHUB_TOKEN));
  await next();
});

app.get('/', (c) => {
  return c.html(`
    <html>
      <head>
        <title>GitHub Streak Stats</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
          pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>🔥 GitHub Streak Stats</h1>
        <p>Add your GitHub streak stats to your README!</p>
        <h2>Usage</h2>
        <p>Add this to your README.md:</p>
        <pre>[![GitHub Streak](${c.req.url}streak/YOUR_GITHUB_USERNAME)](${c.req.url})</pre>
      </body>
    </html>
  `);
});

app.get(
  '/streak/:username',
  cache({
    cacheName: 'github-streak',
    cacheControl: 'public, max-age=43200',
  }),
  async (c) => {
    try {
      const username = c.req.param('username');
      const githubService = c.get('githubService');
      const stats = await githubService.getCommitHistory(username);
      return c.json(stats);
    } catch (error) {
      return c.json({ error: 'Failed to fetch streak stats' }, 500);
    }
  }
);

// Badge endpoint
app.get(
  '/streak/:username/badge',
  cache({
    cacheName: 'github-streak-badge',
    cacheControl: 'public, max-age=43200',
  }),
  async (c) => {
    try {
      const username = c.req.param('username');
      const githubService = c.get('githubService');
      const stats = await githubService.getCommitHistory(username);
      const svg = BadgeService.generateStreakBadge(stats);

      c.header('Content-Type', 'image/svg+xml');
      c.header('Cache-Control', 'public, max-age=43200');
      return c.body(svg);
    } catch (error) {
      return c.json({ error: 'Failed to generate badge' }, 500);
    }
  }
);

// Test route to display all tier badges
app.get('/test/badges', (c) => {
  const svg = BadgeService.generateTestBadges();
  c.header('Content-Type', 'image/svg+xml');
  return c.body(svg);
});

export default app;
