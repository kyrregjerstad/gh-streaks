import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { GitHubService } from './services/github.service';
import { BadgeService } from './services/badge.service';
import type { FC } from 'hono/jsx';

const Layout: FC = (props) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          html {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          }
          body {
            font-family: inherit;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #f8f9fa;
            color: #212529;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          h1 {
            color: #2d333b;
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 2px solid #e1e4e8;
            padding-bottom: 0.5rem;
          }
          h2 {
            color: #2d333b;
            font-size: 1.8rem;
            margin-top: 2rem;
          }
          p {
            margin: 1rem 0;
            font-size: 1.1rem;
          }
          pre {
            background-color: #f1f3f5;
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid #e1e4e8;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
          }
          .emoji {
            font-size: 2rem;
            margin-right: 0.5rem;
            vertical-align: middle;
          }
          .container {
            background-color: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
        `}</style>
      </head>
      <body>
        <div class="container">{props.children}</div>
      </body>
    </html>
  );
};

const Home: FC<{ baseUrl: string }> = ({ baseUrl }) => {
  return (
    <Layout>
      <h1>
        <span class="emoji">🔥</span>GitHub Streak Stats
      </h1>
      <p>
        Add your GitHub streak stats to your README to showcase your consistent
        contributions!
      </p>
      <h2>Usage</h2>
      <p>Copy and paste this code into your README.md:</p>
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
