export const TOKEN_PACKAGES = [
  {
    id: 'starter',
    label: 'Starter',
    tokens: 100,
    amountInPaise: 9900,
    description: 'Best for first-time buyers'
  },
  {
    id: 'growth',
    label: 'Growth',
    tokens: 600,
    amountInPaise: 49900,
    description: 'Popular plan for active creators'
  },
  {
    id: 'pro',
    label: 'Pro',
    tokens: 1500,
    amountInPaise: 99900,
    description: 'Maximum value for teams and power users'
  }
];

export const tokenPackageMap = new Map(TOKEN_PACKAGES.map((item) => [item.id, item]));
