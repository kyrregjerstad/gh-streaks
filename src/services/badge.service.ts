interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalCommits: number;
}

interface Tier {
  emoji: string;
  label: string;
  gradientStart: string;
  gradientEnd: string;
}

export class BadgeService {
  private static readonly THRESHOLDS = [
    3, 7, 14, 21, 30, 50, 100, 250, 365, 500, 750, 1000,
  ];

  private static getTier(streak: number): Tier {
    if (streak >= 1000)
      return {
        emoji: '🌌',
        label: 'Universal Constant',
        gradientStart: '#020617',
        gradientEnd: '#1e1b4b',
      };
    if (streak >= 750)
      return {
        emoji: '🪐',
        label: 'Celestial',
        gradientStart: '#2e1065',
        gradientEnd: '#581c87',
      };
    if (streak >= 500)
      return {
        emoji: '☄️',
        label: 'Cosmic',
        gradientStart: '#312e81',
        gradientEnd: '#4c1d95',
      };
    if (streak >= 365)
      return {
        emoji: '🌠',
        label: 'Astral',
        gradientStart: '#1e3a8a',
        gradientEnd: '#3730a3',
      };
    if (streak >= 250)
      return {
        emoji: '🌑',
        label: 'Lunar',
        gradientStart: '#0f172a',
        gradientEnd: '#1e293b',
      };

    if (streak >= 100)
      return {
        emoji: '🔮',
        label: 'Mythical',
        gradientStart: '#3b0764',
        gradientEnd: '#9333ea',
      };
    if (streak >= 50)
      return {
        emoji: '🌟',
        label: 'Legendary',
        gradientStart: '#854d0e',
        gradientEnd: '#ca8a04',
      };
    if (streak >= 30)
      return {
        emoji: '👑',
        label: 'Royal',
        gradientStart: '#b45309',
        gradientEnd: '#d97706',
      };
    if (streak >= 21)
      return {
        emoji: '🚀',
        label: 'Soaring',
        gradientStart: '#0369a1',
        gradientEnd: '#0284c7',
      };
    if (streak >= 14)
      return {
        emoji: '💪',
        label: 'Strong',
        gradientStart: '#7f1d1d',
        gradientEnd: '#991b1b',
      };
    if (streak >= 7)
      return {
        emoji: '⚡',
        label: 'Electric',
        gradientStart: '#ca8a04',
        gradientEnd: '#eab308',
      };
    if (streak >= 3)
      return {
        emoji: '🔥',
        label: 'On Fire',
        gradientStart: '#9a3412',
        gradientEnd: '#ea580c',
      };
    return {
      emoji: '🌱',
      label: 'Seedling',
      gradientStart: '#166534',
      gradientEnd: '#16a34a',
    };
  }

  static generateStreakBadge(
    stats: StreakStats,
    gradientId: string = 'tierGradient'
  ): string {
    const width = 320;
    const height = 350;
    const tier = this.getTier(stats.currentStreak);

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${tier.gradientStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${tier.gradientEnd};stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap');
        .card { fill: #1E1E2E; rx: 24; }
        .tier-badge-${gradientId} { fill: url(#${gradientId}); rx: 20; }
        .emoji { font: 500 72px 'Inter', sans-serif; fill: #FFFFFF; }
        .text-tier { font: 500 24px 'Inter', sans-serif; fill: #FFFFFF; }
        .text-streak { font: 700 72px 'Inter', sans-serif; fill: #FFFFFF; }
        .text-days { font: 400 20px 'Inter', sans-serif; fill: #FFFFFF; opacity: 0.9; }
        .text-label { font: 500 16px 'Inter', sans-serif; fill: #9CA3AF; }
        .text-value { font: 500 16px 'Inter', sans-serif; fill: #FFFFFF; }
        .text-next-tier { font: 400 14px 'Inter', sans-serif; fill: #6B7280; }
      </style>

      <!-- Main card background -->
      <rect class="card" x="0" y="0" width="${width}" height="${height}"/>

      <!-- Tier badge with gradient -->
      <rect class="tier-badge-${gradientId}" x="50" y="20" width="220" height="250"/>
      
      <!-- Tier info -->
      <text x="160" y="100" class="emoji" text-anchor="middle">
        ${tier.emoji}
      </text>
      <text x="160" y="145" class="text-tier" text-anchor="middle">
        ${tier.label}
      </text>
      
      <!-- Streak number and days -->
      <text x="160" y="220" class="text-streak" text-anchor="middle">
        ${stats.currentStreak}
      </text>
      <text x="160" y="250" class="text-days" text-anchor="middle">
        days
      </text>

      <!-- Stats -->
      <g transform="translate(20, 305)">
        <text x="0" y="0" class="text-label">Longest Streak:</text>
        <text x="280" y="0" class="text-value" text-anchor="end">${
          stats.longestStreak
        } days</text>
        
        <!-- Next tier info -->
        <text x="0" y="20" class="text-next-tier">
        ${this.getNextTierText(stats.currentStreak)}
        </text>
        </g>
    </svg>`.trim();
  }

  private static getNextTierText(currentStreak: number): string {
    const nextThreshold = this.THRESHOLDS.find((t) => t > currentStreak);
    return nextThreshold ? `${nextThreshold - currentStreak} days until next tier` : '';
  }

  static generateTestBadges(): string {
    const width = 320;
    const height = 350;
    const padding = 20;
    const columns = 4;
    const rows = Math.ceil((this.THRESHOLDS.length + 1) / columns);
    const totalWidth = (width + padding) * columns;
    const totalHeight = (height + padding) * rows;

    const badges = [0, ...this.THRESHOLDS].map((streak, index) => {
      const stats: StreakStats = {
        currentStreak: streak,
        longestStreak: streak,
        totalCommits: streak * 10,
      };
      const gradientId = `tierGradient${index}`;
      const x = (index % columns) * (width + padding);
      const y = Math.floor(index / columns) * (height + padding);

      return `
        <g transform="translate(${x}, ${y})">
          ${this.generateStreakBadge(stats, gradientId)}
        </g>
      `;
    });

    return `
    <svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}"
      xmlns="http://www.w3.org/2000/svg">
      ${badges.join('\n')}
    </svg>`.trim();
  }
}
