// Influencer pricing calculator cards and notes. The rates themselves live in rates.js.
import { Camera, Play, TriangleAlert, Video } from 'lucide-react';
import { PLATFORMS, formatGBP, rateFor } from './rates.js';

const ICONS = { instagram: Camera, tiktok: Video, youtube: Play };

/** Three platform cards. `values` holds the view counts; `onChange` receives a partial update. */
export function PricingCalculator({ values, onChange, readOnly = false, compact = false }) {
  return (
    <div className={`pricing ${compact ? 'compact' : ''}`}>
      {PLATFORMS.map(({ key, name, perThousand, tone }) => {
        const Icon = ICONS[tone];
        const rate = rateFor(values[key], perThousand);
        return (
          <div key={key} className="priceCard">
            <span className={`platformIcon ${tone}`}>
              <Icon size={compact ? 16 : 20} />
            </span>
            <b>{name}</b>
            <small>£{perThousand} per 1,000 views</small>
            <label>
              Average views
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="Enter view count"
                value={values[key] ?? ''}
                readOnly={readOnly}
                onChange={(e) => onChange({ [key]: e.target.value })}
              />
            </label>
            <div className="rateBox">
              <small>Recommended rate</small>
              <strong className={tone}>{formatGBP(rate ?? 0)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The extra-charges notes that go with the calculator. */
export function PricingNotes() {
  return (
    <div className="pricingNotes">
      <h3>Important pricing information</h3>
      <p className="warn">
        <TriangleAlert size={15} /> These are rough estimates for the basic post only.
      </p>
      <b>Common brand requests &amp; extra charges</b>
      <ul>
        <li>
          <b>Multi-platform posts:</b> brands often ask for a TikTok post + Instagram repost + link in Linktree for 7 days. Combined rate:
          £75 per 1,000 views (£30 TikTok + £45 Instagram).
        </li>
        <li>
          <b>Content usage rights:</b> 25% of the contract value per month when a brand wants to use the content in paid ads.
        </li>
        <li>
          <b>Link in Linktree:</b> free for 7 days, then extra charges apply.
        </li>
        <li>
          <b>TikTok Spark Ad boost:</b> 25% of the contract value per month.
        </li>
      </ul>
      <p>Always discuss usage rights and extra requirements with brands during negotiations so the price is right.</p>
    </div>
  );
}
