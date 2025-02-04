import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { GitHubService } from './services/github.service';
import { BadgeService } from './services/badge.service';
import type { FC } from 'hono/jsx';

const Layout: FC = (props) => {
  return (
    <html>
      <body>{props.children}</body>
    </html>
  );
};

const Home: FC<{ baseUrl: string }> = ({ baseUrl }) => {
  return (
    <Layout>
      <h1>🔥 GitHub Streak Stats</h1>
      <p>Add your GitHub streak stats to your README!</p>
      <h2>Usage</h2>
      <p>Add this to your README.md:</p>
      <pre>
        [![GitHub Streak](${baseUrl}streak/YOUR_GITHUB_USERNAME)](${baseUrl})
      </pre>
    </Layout>
  );
};

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
  return c.html(<Home baseUrl={c.req.url} />);
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
