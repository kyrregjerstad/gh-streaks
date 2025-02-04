# 🔥 GitHub Streak Stats

A dynamic GitHub contribution streak badge generator that displays your current streak of daily contributions. This service helps developers showcase their consistency in contributing to GitHub repositories.

> Inspired by [DenverCoder1/github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats), but rebuilt with Cloudflare Workers for improved reliability and enhanced with a fun tier system that rewards longer streaks with increasingly prestigious badges! 🏆

## 🌟 Features

- Real-time GitHub contribution streak tracking
- Beautiful SVG badges that automatically update
- Progressive tier system - earn more prestigious badges as your streak grows!
- 12-hour caching for great performance
- Easy integration with GitHub README profiles
- Cloudflare Workers-powered for global edge deployment

## 🎯 Badge Tiers

Want to see all the awesome badges you can earn? Check out our test page:

```markdown
https://gh-streaks.kyrregjerstad.workers.dev/test/badges
```

As your streak grows, you'll progress through different tiers, each with its own unique badge design. Keep contributing to level up! 🎮

## 🚀 Usage

Add your GitHub streak stats to your README by copying and pasting this code:

```markdown
[![GitHub Streak](https://gh-streaks.kyrregjerstad.workers.dev/streak/YOUR_GITHUB_USERNAME/badge)](https://gh-streaks.kyrregjerstad.workers.dev)
```

Replace `YOUR_GITHUB_USERNAME` with your GitHub username.

## 🛠️ Development

### Prerequisites

- [Bun](https://bun.sh/) for running the project locally
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for Cloudflare Workers deployment
- A GitHub Personal Access Token with appropriate permissions

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/gh-streaks.git
cd gh-streaks
```

2. Install dependencies:

```bash
bun install
```

3. Create a `.dev.vars` file with your GitHub token:

```
GITHUB_TOKEN=your_github_token_here
```

4. Run the development server:

```bash
bun run dev
```

### Scripts

- `bun run dev` - Start the development server
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun test` - Run tests
- `bun run bench` - Run benchmarks

## 🔒 Environment Variables

- `GITHUB_TOKEN` - GitHub Personal Access Token for API authentication

## 🏗️ Built With

- [Hono](https://hono.dev/) - Lightweight web framework
- [Octokit](https://github.com/octokit) - GitHub API client
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [Bun](https://bun.sh/) - JavaScript runtime and toolkit

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
