import { useState } from 'react';
import { Calculator, Calendar, ChevronDown, Copy, ExternalLink, Handshake, Phone, Plus, Presentation, UserCheck } from 'lucide-react';
import {
  BOOKING_OPTIONS,
  CALL_GUIDE_URL,
  FIT_OPTIONS,
  MIN_FOLLOWERS_LABEL,
  ONBOARDING_LINK,
  PARTNERED_LINK,
  WORKFLOW_DEFAULTS,
  engagementRateFrom,
  today,
} from './data.js';
import { DECK_LANGUAGES, ENGLISH_DECKS, SIGNING_DECKS_PAGE, chooseDeck } from './decks.js';
import { PricingCalculator, PricingNotes } from './Pricing.jsx';
import { PRICING_CALCULATOR_PAGE, rateSummary } from './rates.js';

/** Works out an engagement rate from average likes and comments, ready to fill in. */
function ErCalculator({ followers, onUse }) {
  const [posts, setPosts] = useState('12');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const rate = engagementRateFrom(likes, comments, followers);
  const hasFollowers = Number(followers) > 0;
  const number = (value, set, labelText, min = 0) => (
    <label>
      {labelText}
      <input type="number" min={min} step="any" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
  return (
    <div className="erCalc">
      <div className="erHead">
        <b>
          <Calculator size={14} /> ER calculator
        </b>
        <small>Average likes and comments from recent posts (from an extension, or counted on Instagram).</small>
      </div>
      <div className="erRow">
        {number(posts, setPosts, 'Posts counted', 1)}
        {number(likes, setLikes, 'Avg likes')}
        {number(comments, setComments, 'Avg comments')}
        <div className="erResult">
          <small>ER</small>
          <strong>{rate ? `${rate}%` : '—'}</strong>
        </div>
      </div>
      {hasFollowers ? (
        <button type="button" disabled={!rate} onClick={() => onUse(rate, posts)}>
          Use {rate ? `${rate}%` : 'this rate'}
        </button>
      ) : (
        <p className="help">Add the follower count above first.</p>
      )}
    </div>
  );
}

const LATE_STAGES = ['Signed', 'Contract signed', 'Call completed', 'Contract sent', 'Closed'];
const SIGNED_STAGES = ['Signed', 'Contract signed', 'Closed'];

const newCall = () => ({
  id: crypto.randomUUID(),
  date: today(),
  brandDeals: '',
  frequency: '',
  usualRate: '',
  actualRate: '',
  bestMonth: '',
  dealSource: '',
  challenge: '',
  goal: '',
  strideHelp: '',
  nextStep: '',
  followUp: '',
});

/** A link to send to a creator, with Open and Copy buttons. */
function LinkCard({ icon: Icon, tone = '', label, title, text, url, notify }) {
  const copy = () =>
    navigator.clipboard
      .writeText(url)
      .then(() => notify(`${title} link copied`))
      .catch(() => notify('Couldn’t copy. Open the link and copy its address.'));
  return (
    <div className="deckCard">
      <span className={`deckIcon ${tone}`}>
        <Icon size={18} />
      </span>
      <div className="deckInfo">
        <small>{label}</small>
        <b>{title}</b>
        <p>{text}</p>
      </div>
      <div className="deckActions">
        <a href={url} target="_blank" rel="noreferrer">
          Open <ExternalLink size={13} />
        </a>
        <button type="button" onClick={copy}>
          <Copy size={13} />
          Copy link
        </button>
      </div>
    </div>
  );
}

/** Before the call → rate estimate → scheduling → call notes → handoff. `onChange` receives a partial update. */
export default function CallWorkflow({ value, onChange, readOnly = false, notify = () => {} }) {
  const [selectedId, setSelectedId] = useState(null);
  const w = { ...WORKFLOW_DEFAULTS, ...value, calls: value.calls || [] };
  const call = w.calls.find((c) => c.id === selectedId);
  const { deck, reason } = chooseDeck(w);
  const automaticDeck = chooseDeck({ ...w, deckOverride: '' }).deck;
  const copyDeckLink = () =>
    navigator.clipboard
      .writeText(deck.url)
      .then(() => notify('Deck link copied'))
      .catch(() => notify('Couldn’t copy. Open the deck and copy its address.'));
  const updateCall = (patch) => onChange({ calls: w.calls.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)) });

  const field = (key, label, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        step={type === 'number' ? 'any' : undefined}
        min={type === 'number' ? 0 : undefined}
        max={type === 'number' ? 100 : undefined}
        value={String(w[key] ?? '')}
        onChange={(e) => onChange({ [key]: e.target.value })}
      />
    </label>
  );

  const note = (key, label, placeholder) => (
    <label>
      {label}
      <textarea rows={2} value={call?.[key] || ''} placeholder={placeholder} onChange={(e) => updateCall({ [key]: e.target.value })} />
    </label>
  );

  function changeBooking(status) {
    onChange({
      bookingStatus: status,
      ...(status === 'Call booked' && !LATE_STAGES.includes(w.outreach) ? { outreach: 'Call booked' } : {}),
      ...(w.outreach === 'Call booked' && status !== 'Call booked' ? { outreach: 'Replied' } : {}),
    });
  }

  return (
    <div className="workflow">
      <section className="workflowSection">
        <div className="workflowTitle">
          <span>01</span>
          <div>
            <h3>Before the call</h3>
            <p>Review engagement and fit before you connect.</p>
          </div>
        </div>
        <div className="formgrid">
          {field('engagementRate', 'Engagement rate (%)', 'number')}
          {field('engagementDate', 'Last checked', 'date')}
          {field('engagementSource', 'Source / calculation method')}
          <label>
            Creator fit
            <select value={w.fit} onChange={(e) => onChange({ fit: e.target.value })}>
              {FIT_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        <small className="help">
          Use a comparable platform, sample period and method. Engagement is reviewed manually; no automatic cutoff or rejection.
        </small>
        <ErCalculator
          followers={w.followers}
          onUse={(rate, posts) => {
            onChange({ engagementRate: rate, engagementSource: `Avg likes + comments of last ${posts || 12} posts ÷ followers`, engagementDate: today() });
            notify(`Engagement rate set to ${rate}%`);
          }}
        />
      </section>

      <details className="workflowSection">
        <summary>
          <Calculator size={16} />
          Rate estimate <span>{rateSummary(w) || 'Add average views'}</span>
          <ChevronDown size={15} />
        </summary>
        <div className="sectionInner">
          <p className="help">
            Recommended rate for a basic post, from the creator’s average views. Use it as a starting point with brands and adjust for
            engagement.
          </p>
          <PricingCalculator compact values={w} onChange={onChange} />
          <details className="callGuide">
            <summary>
              Extra charges brands often ask about <ChevronDown size={14} />
            </summary>
            <PricingNotes />
          </details>
          <a className="guideLink" href={PRICING_CALCULATOR_PAGE} target="_blank" rel="noreferrer">
            Open Stride’s pricing calculator ↗
          </a>
        </div>
      </details>

      <details className="workflowSection">
        <summary>
          <Calendar size={16} />
          Scheduling &amp; confirmation <span>{w.bookingStatus}</span>
          <ChevronDown size={15} />
        </summary>
        <div className="sectionInner">
          <p className="help">
            Manual verification · Google Calendar is the booking source. Gmail is supporting context. Live sync is not connected.
          </p>
          <div className="formgrid">
            <label className="full">
              Booking status
              <select value={w.bookingStatus} onChange={(e) => changeBooking(e.target.value)}>
                {BOOKING_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            {field('calendarUrl', 'Google Calendar event link', 'url')}
            {field('calendarEmail', 'Creator email on event', 'email')}
            {field('calendarStart', 'Call date & time', 'datetime-local')}
            {field('calendarTimezone', 'Event time zone (IANA)')}
            {field('calendarChecked', 'Confirmed / non-cancelled, checked on', 'date')}
            {field('gmailUrl', 'Gmail thread link (context only)', 'url')}
          </div>
          <label className="notes">
            Scheduling context
            <textarea
              rows={2}
              value={w.bookingNotes}
              placeholder="Proposed time, confirmation, or cancellation details"
              onChange={(e) => onChange({ bookingNotes: e.target.value })}
            />
          </label>
          <small className="help">
            Only select “Call booked” after checking the event is confirmed, not cancelled, and includes this creator’s email. Enter
            its link, time, time zone and check date. A proposed time in an email is not a confirmed booking.
          </small>
          <div className="socialLinks">
            {w.calendarUrl.startsWith('https://') && (
              <a href={w.calendarUrl} target="_blank" rel="noreferrer">
                Open event <ExternalLink size={13} />
              </a>
            )}
            {w.gmailUrl.startsWith('https://') && (
              <a href={w.gmailUrl} target="_blank" rel="noreferrer">
                Open thread <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </details>

      <section className="workflowSection callSection">
        <div className="workflowTitle">
          <span>02</span>
          <div>
            <h3>Creator calls</h3>
            <p>A conversation, with only the details you need.</p>
          </div>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              const created = newCall();
              onChange({ calls: [created, ...w.calls] });
              setSelectedId(created.id);
            }}
          >
            <Plus size={14} />
            Log call
          </button>
        </div>

        <div className="deckCard">
          <span className="deckIcon">
            <Presentation size={18} />
          </span>
          <div className="deckInfo">
            <small>SIGNING DECK</small>
            <b>{deck.name}</b>
            <p>{reason}</p>
          </div>
          <div className="deckActions">
            <a href={deck.url} target="_blank" rel="noreferrer">
              Open deck <ExternalLink size={13} />
            </a>
            <button type="button" onClick={copyDeckLink}>
              <Copy size={13} />
              Copy link
            </button>
          </div>
        </div>
        <div className="formgrid deckPick">
          <label>
            Deck language
            <select value={w.deckLanguage} onChange={(e) => onChange({ deckLanguage: e.target.value })}>
              {DECK_LANGUAGES.map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
          {w.deckLanguage === 'English' && (
            <label>
              Deck
              <select value={w.deckOverride} onChange={(e) => onChange({ deckOverride: e.target.value })}>
                <option value="">Automatic · {automaticDeck.short}</option>
                {ENGLISH_DECKS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.short}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <a className="guideLink" href={SIGNING_DECKS_PAGE} target="_blank" rel="noreferrer">
          All signing decks ↗
        </a>

        {!w.calls.length && <p className="help">No calls logged yet. Add one when you’re ready; save the creator to keep your notes.</p>}

        {w.calls.length > 0 && (
          <div className="callList">
            {w.calls.map((c, i) => (
              <button
                type="button"
                key={c.id}
                className={selectedId === c.id ? 'selected' : ''}
                onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
              >
                <Phone size={13} />
                {c.date || 'Undated call'}
                <span>{c.nextStep || `Call ${w.calls.length - i}`}</span>
              </button>
            ))}
          </div>
        )}

        {call && (
          <div className="callForm">
            <label>
              Call date
              <input type="date" value={call.date} onChange={(e) => updateCall({ date: e.target.value })} />
            </label>

            <details className="callGuide">
              <summary>
                Quick guide for the conversation <ChevronDown size={14} />
              </summary>
              <p>
                <b>Open naturally:</b> “I’d love to hear about your journey and what you’re building. If there’s a fit, we can talk
                about how Stride could help. Sound okay?”
              </p>
              <ol>
                <li>Set the tone · 2 min</li>
                <li>Their story · 5 min</li>
                <li>Their problems · 8 min</li>
                <li>The cost of staying put · 3 min</li>
                <li>What good looks like · 4 min</li>
                <li>
                  Bring in Stride · 5 min · walk through the{' '}
                  <a href={deck.url} target="_blank" rel="noreferrer">
                    {deck.name}
                  </a>
                </li>
                <li>A clear next step · 3 min</li>
              </ol>
              <p>
                Listen first. Go deeper on two or three problems. Match Stride’s support to what they said, and finish with a specific
                next step and date.
              </p>
              <a href={CALL_GUIDE_URL} target="_blank" rel="noreferrer">
                View full PDF guide ↗
              </a>
            </details>

            <h4>Get to know their business</h4>
            <label>
              Have you worked with brands before?
              <select value={call.brandDeals} onChange={(e) => updateCall({ brandDeals: e.target.value })}>
                <option value="">Not discussed yet</option>
                <option>Yes — paid collaborations</option>
                <option>Gifting / affiliate only</option>
                <option>No</option>
              </select>
            </label>
            {note('frequency', 'How often do you get paid brand deals?', 'Approximate deals per month, or how frequently')}
            <div className="formgrid">
              {note('usualRate', 'What do you usually charge?', 'Amount + currency, platform and deliverables')}
              {note('actualRate', 'What do you usually end up getting paid?', 'Agreed / received fee + currency and comparable scope')}
            </div>
            {note('bestMonth', 'What has your best month looked like?', 'Number of paid deals, total earnings + currency, and month if known')}
            <label>
              Where do deals come from?
              <select value={call.dealSource} onChange={(e) => updateCall({ dealSource: e.target.value })}>
                <option value="">Not discussed yet</option>
                <option>Brands reach out (inbound)</option>
                <option>Creator pitches brands (outbound)</option>
                <option>Both inbound and outbound</option>
                <option>Agency / manager</option>
                <option>No deals yet</option>
              </select>
            </label>

            <h4>Understand what they need</h4>
            {note('challenge', 'What’s the hardest part of managing brand deals right now?', 'Capture their words, not a sales pitch')}
            {note('goal', 'What would you like to achieve over the next year?', 'Goals, dream brands, or support they want')}

            <h4>Agree on the next step</h4>
            {note('strideHelp', 'How could Stride help?', 'Up to three points tied to what they said')}
            {note('nextStep', 'Next step', 'What happens next, and who owns it?')}
            <label>
              Follow-up date
              <input type="date" value={call.followUp} onChange={(e) => updateCall({ followUp: e.target.value })} />
            </label>
            <div className="callActions">
              <button
                type="button"
                disabled={readOnly || ['Signed', 'Contract signed'].includes(w.outreach)}
                onClick={() => onChange({ outreach: 'Call completed', ...(call.followUp ? { followUp: call.followUp } : {}) })}
              >
                Mark call completed &amp; apply follow-up
              </button>
            </div>
            <small className="help">
              Notes and status changes are saved with “Save creator”. Applying a follow-up updates the creator’s due date; it does not
              create a calendar event.
            </small>
          </div>
        )}

        {!call && (
          <a className="guideLink" href={CALL_GUIDE_URL} target="_blank" rel="noreferrer">
            View full call guide ↗
          </a>
        )}
      </section>

      <details className="workflowSection" open={SIGNED_STAGES.includes(w.outreach)}>
        <summary>
          After the decision <span>Contract → handoff</span>
          <ChevronDown size={15} />
        </summary>
        <div className="sectionInner">
          <p className="help">
            This workspace ends at contract signature. Ongoing signed-creator management belongs in Stride OS. Creators who do not sign
            can receive the Stride Partner link for future campaigns.
          </p>
          <LinkCard
            icon={UserCheck}
            tone="green"
            label="SIGNED"
            title="Onboarding Talent"
            text="Send to creators who signed, so they’re onboarded into Stride OS."
            url={ONBOARDING_LINK}
            notify={notify}
          />
          <LinkCard
            icon={Handshake}
            tone="purple"
            label="NOT SIGNING OR UNDER MINIMUM"
            title="Partnered"
            text={`Send to creators who don’t sign, or are under ${MIN_FOLLOWERS_LABEL} followers, to join the partnered creator network.`}
            url={PARTNERED_LINK}
            notify={notify}
          />
          <div className="formgrid">
            <label>
              Stride OS handoff
              <select value={w.handoffStatus} onChange={(e) => onChange({ handoffStatus: e.target.value })}>
                <option>Not handed off</option>
                <option>Ready for handoff</option>
                <option>Handed off to Stride OS</option>
              </select>
            </label>
            {field('handoffUrl', 'Stride OS creator link', 'url')}
            <label>
              Stride Partner referral
              <select value={w.partnerStatus} onChange={(e) => onChange({ partnerStatus: e.target.value })}>
                <option>Not sent</option>
                <option>Ready to send</option>
                <option>Sent</option>
                <option>Not applicable</option>
              </select>
            </label>
          </div>
          <small className="help">
            Track the handoff or referral here after you complete it. No transfer or message is sent automatically. Stride Suite
            eligibility referrals stay separate.
          </small>
          {w.partnerUrl.startsWith('https://') && (
            <a className="guideLink" href={w.partnerUrl} target="_blank" rel="noreferrer">
              Open Stride Partner ↗
            </a>
          )}
          {w.handoffUrl.startsWith('https://') && (
            <a className="guideLink" href={w.handoffUrl} target="_blank" rel="noreferrer">
              Open Stride OS ↗
            </a>
          )}
        </div>
      </details>
    </div>
  );
}
