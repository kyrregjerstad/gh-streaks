export class BadgeService {
  static generateStreakBadge(stats: {
    currentStreak: number;
    longestStreak: number;
    totalCommits: number;
  }): string {
    const width = 495;
    const height = 195;
    const padding = 15;
    const fontSize = 14;
    const titleSize = 18;

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <style>
        .stats { font: ${fontSize}px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: #434d58; }
        .stats-title { font: 600 ${titleSize}px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: #434d58; }
        .stat { font: 600 ${fontSize}px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif; fill: #434d58; }
      </style>
      
      <rect x="0.5" y="0.5" rx="4.5" height="99%" stroke="#e4e2e2" width="494" fill="#fffefe"/>
      
      <text x="25" y="45" class="stats-title">🔥 GitHub Streak Stats</text>

      <g transform="translate(0, ${padding + titleSize + padding})">
        <text x="25" y="40" class="stats">Current Streak</text>
        <text x="25" y="65" class="stat">${stats.currentStreak} days</text>
        
        <text x="175" y="40" class="stats">Longest Streak</text>
        <text x="175" y="65" class="stat">${stats.longestStreak} days</text>
        
        <text x="325" y="40" class="stats">Total Commits</text>
        <text x="325" y="65" class="stat">${stats.totalCommits}</text>
      </g>
    </svg>`.trim();
  }
}
