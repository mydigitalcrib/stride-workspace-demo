// Influencer pricing rules, from https://stride-education.com/influencer-pricing-calculator

export const PRICING_CALCULATOR_PAGE = 'https://stride-education.com/influencer-pricing-calculator';

/** Recommended rate = average views ÷ 1,000 × the platform's rate (in pounds). */
export const PLATFORMS = [
  { key: 'viewsInstagram', name: 'Instagram', short: 'IG', perThousand: 70, tone: 'instagram' },
  { key: 'viewsTiktok', name: 'TikTok', short: 'TT', perThousand: 60, tone: 'tiktok' },
  { key: 'viewsYoutube', name: 'YouTube', short: 'YT', perThousand: 130, tone: 'youtube' },
];

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const gbpRounded = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export const formatGBP = (amount, rounded = false) => (rounded ? gbpRounded : gbp).format(amount);

/** Returns the recommended rate in pounds, or null when there's no valid view count. */
export function rateFor(views, perThousand) {
  if (views === '' || views == null) return null;
  const n = Number(views);
  return Number.isFinite(n) && n >= 0 ? (n / 1000) * perThousand : null;
}

/** Short summary like "IG £864 · TT £741", or '' when no views are entered. */
export function rateSummary(values) {
  return PLATFORMS.map((p) => {
    const rate = rateFor(values[p.key], p.perThousand);
    return rate === null ? null : `${p.short} ${formatGBP(rate, true)}`;
  })
    .filter(Boolean)
    .join(' · ');
}
