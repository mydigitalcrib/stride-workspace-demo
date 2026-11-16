import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CalendarDays,
  Check,
  DatabaseBackup,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  LayoutDashboard,
  Lock,
  Leaf,
  MessageSquare,
  Moon,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  Trash2,
  TriangleAlert,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import CallWorkflow from './CallWorkflow.jsx';
import BackupPanel from './Backup.jsx';
import { lastBackupAt, needsBackup } from './backup.js';
import SecurityPanel, { useLock } from './Lock.jsx';
import { getFileStatus, onFileStatus } from './fileSync.js';
import CalendarPage, { EventEditor, newEvent } from './Calendar.jsx';
import { EMPTY_EVENT, creatorItems, dueReminders, eventLabel, formatDate, formatTime, sampleEvents, validateEvent } from './calendar.js';
import trendReportTemplateRaw from './content/weekly-trend-report.txt?raw';

// The weekly trend report template, shown as-is for copying. Edit src/content/weekly-trend-report.txt to update it.
const trendReportTemplate = trendReportTemplateRaw.replace(/\r\n/g, '\n').trimEnd();
import Personalize from './Personalize.jsx';
import { CountUp, GlassBackdrop } from './motion.jsx';
import { DEFAULT_APPEARANCE, applyAppearance, computeAppearance, loadAppearance, resolveMode, saveAppearance } from './appearance.js';

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');
import { applyImportPlan, creatorsToCsv, downloadCsv, planImport } from './csv.js';
import ImportDialog from './ImportDialog.jsx';
import { SIGNING_DECKS_PAGE } from './decks.js';
import { PricingCalculator, PricingNotes } from './Pricing.jsx';
import { PRICING_CALCULATOR_PAGE } from './rates.js';
import {
  APPROVAL_OPTIONS,
  CALL_GUIDE_URL,
  DEFAULT_TEMPLATES,
  EMPTY_CREATOR,
  FILTERS,
  LEGACY_STAGES,
  MIN_FOLLOWERS,
  MIN_FOLLOWERS_LABEL,
  ONBOARDING_LINK,
  PARTNERED_LINK,
  PIPELINE_STAGES,
  UNDER_MIN_FILTER,
  WORKFLOW_DEFAULTS,
  formatFollowers,
  hasFollowerCount,
  isDue,
  isUnderMinimum,
  missingDetails,
  personalise,
  plural,
  sampleCreators,
  searchText,
  today,
  validateWorkflow,
} from './data.js';
import { deleteCreator, deleteEvent, loadWorkspace, saveImport, saveRecord } from './storage.js';

const TREND_REPORT = 'Weekly trend report';
const CALENDAR = 'My calendar';
const VIEWS = ['Overview', CALENDAR, 'Creators', 'Follow-ups', 'Templates', 'Pricing', TREND_REPORT];
const NAV_ICONS = {
  Overview: LayoutDashboard,
  [CALENDAR]: CalendarDays,
  Creators: Users,
  'Follow-ups': Clock3,
  Templates: MessageSquare,
  Pricing: Calculator,
  [TREND_REPORT]: TrendingUp,
};
const HEADINGS = {
  [CALENDAR]: ['My calendar.', 'Plan your week, from creator outreach to Friday brand pitches.'],
  [TREND_REPORT]: ['Weekly trend report.', 'The template for Stride’s weekly trend reports, ready to copy and paste.'],
  Pricing: ['Fair rates, made simple.', 'Recommended rates from a creator’s average views, ready for your next brand conversation.'],
  Overview: ['Good talent. Great possibilities.', 'A little clarity for every connection. Here’s where your outreach stands.'],
  Creators: ['Your creator network.', 'Discover, review, and nurture your next great partnerships.'],
  'Follow-ups': ['Keep the conversation going.', 'Every relationship deserves a thoughtful next step.'],
  Templates: ['The right words, ready to go.', 'Reusable outreach templates with your personal touch.'],
};
const NICHE_COLORS = ['#286254', '#8facdf', '#b9a2ce', '#e8bb82', '#a8bda0'];
const TRACKED_CHANGES = ['approval', 'outreach', 'followUp', 'owner', 'fit', 'bookingStatus', 'engagementRate', 'handoffStatus', 'partnerStatus'];

// Each page has its own address (#/creators, #/follow-ups…) so refresh, back and shared links work.
const slugFor = (view) => view.toLowerCase().replace(/\s+/g, '-');
const viewFromHash = () => VIEWS.find((v) => `#/${slugFor(v)}` === window.location.hash.toLowerCase()) || 'Overview';
const defaultFilterFor = (view) => (view === 'Follow-ups' ? 'Follow-up needed' : 'All creators');

function Badge({ value }) {
  const tone =
    value === 'Approved'
      ? 'green'
      : value === 'Declined'
        ? 'red'
        : value.includes('Suite')
          ? 'purple'
          : ['Contacted', 'Replied', 'Meeting booked'].includes(value)
            ? 'blue'
            : value === 'Follow-up needed'
              ? 'orange'
              : 'gray';
  return (
    <span className={`badge ${tone}`}>
      <i />
      {value}
    </span>
  );
}

export default function App() {
  const [creators, setCreators] = useState([]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  // The public demo opens on the fictional sample creators.
  const [sampleMode, setSampleMode] = useState(import.meta.env.VITE_DEMO === '1');
  const [view, setView] = useState(viewFromHash);
  const [filter, setFilter] = useState(() => defaultFilterFor(viewFromHash()));
  const [query, setQuery] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [draft, setDraft] = useState(null); // creator open in the drawer
  const [templateDraft, setTemplateDraft] = useState(null);
  const [events, setEvents] = useState([]); // calendar items
  const [eventDraft, setEventDraft] = useState(null); // { value, isNew }
  const [eventError, setEventError] = useState('');
  const [backupOpen, setBackupOpen] = useState(false);
  const [lastBackup, setLastBackup] = useState(lastBackupAt);
  const [dataVersion, setDataVersion] = useState(0); // bumps after a restore so pages reload their settings
  const [securityOpen, setSecurityOpen] = useState(false);
  const lock = useLock();
  const [fileStatus, setFileStatus] = useState(getFileStatus);
  useEffect(() => onFileStatus(setFileStatus), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [importPlan, setImportPlan] = useState(null); // { plan, fileName } waiting for confirmation
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [pricingViews, setPricingViews] = useState({ viewsInstagram: '', viewsTiktok: '', viewsYoutube: '' });
  const [appearance, setAppearance] = useState(loadAppearance);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [appearanceError, setAppearanceError] = useState('');
  const [systemDark, setSystemDark] = useState(() => !!darkQuery()?.matches);
  const mode = resolveMode(appearance.mode, systemDark);
  const look = useMemo(() => computeAppearance(appearance, mode), [appearance, mode]);

  // Follow the device's light/dark setting when "Match my device" is chosen.
  useEffect(() => {
    const query = darkQuery();
    if (!query) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Apply the chosen colours to the whole page and remember them.
  useEffect(() => applyAppearance(look), [look]);
  useEffect(() => {
    try {
      saveAppearance(appearance);
      setAppearanceError('');
    } catch {
      setAppearanceError('This image is too big to keep after you close the page. Try a smaller image.');
    }
  }, [appearance]);
  const fileInput = useRef(null);
  const toastTimer = useRef(null);
  const viewRef = useRef(view);

  const showToast = (message, ms = 4000) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), ms);
  };

  async function load() {
    setLoading(true);
    try {
      const data = await loadWorkspace();
      setCreators(data.creators.map((c) => ({ ...WORKFLOW_DEFAULTS, ...c, calls: c.calls || [] })));
      setEvents(data.events.map((e) => ({ ...EMPTY_EVENT, ...e })));
      setTemplates([
        ...DEFAULT_TEMPLATES.map((t) => data.templates.find((saved) => saved.id === t.id) || t),
        ...data.templates.filter((saved) => !DEFAULT_TEMPLATES.some((t) => t.id === saved.id)),
      ]);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Coming back from "Forgot your password? → Erase": go straight to restoring a backup.
  useEffect(() => {
    if (lock.startup !== 'erased') return;
    lock.clearStartup();
    setBackupOpen(true);
    showToast('Workspace erased. Restore your backup file to get your data back.', 8000);
  }, [lock.startup]);

  /** After a restore or undo: reload data, look and calendar settings without leaving the page. */
  function afterRestore(message) {
    setBackupOpen(false);
    setSampleMode(false);
    setAppearance(loadAppearance());
    setLastBackup(lastBackupAt());
    setDataVersion((v) => v + 1);
    load();
    showToast(message, 6000);
  }

  function goTo(nextView, nextFilter = defaultFilterFor(nextView)) {
    if (nextView !== viewRef.current) window.scrollTo(0, 0);
    viewRef.current = nextView;
    setView(nextView);
    setFilter(nextFilter);
    setQuery('');
    setNicheFilter('');
    setOwnerFilter('');
    setImportErrors([]);
    const hash = `#/${slugFor(nextView)}`;
    if (window.location.hash !== hash) window.location.hash = hash;
  }

  // Back/forward buttons and pasted links.
  useEffect(() => {
    const onHashChange = () => {
      const next = viewFromHash();
      if (next !== viewRef.current) goTo(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Escape closes whichever panel is open.
  useEffect(() => {
    if (!draft && !templateDraft && !personalizeOpen && !eventDraft && !backupOpen && !securityOpen && !importPlan) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || busy) return;
      setDraft(null);
      setTemplateDraft(null);
      setPersonalizeOpen(false);
      setEventDraft(null);
      setBackupOpen(false);
      setSecurityOpen(false);
      setImportPlan(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, templateDraft, personalizeOpen, eventDraft, backupOpen, securityOpen, importPlan, busy]);

  const samples = useMemo(() => (sampleMode ? sampleCreators() : []), [sampleMode]);
  const list = sampleMode ? samples : creators;

  // ---- My calendar ----
  const sampleCalendar = useMemo(() => (sampleMode ? sampleEvents() : []), [sampleMode]);
  const calendarEvents = sampleMode ? sampleCalendar : events;
  const todayOpenCount = [...calendarEvents, ...creatorItems(list)].filter((e) => e.date === today() && !e.done).length;

  /** Saves a calendar item (used by the editor, drag and drop, done ticks and status changes). */
  async function saveEvent(item, { fromEditor = false } = {}) {
    if (sampleMode) {
      showToast('Sample preview is read-only. Switch to My workspace to plan your own week.');
      return false;
    }
    const problem = validateEvent(item);
    if (problem) {
      if (fromEditor) setEventError(problem);
      else showToast(problem);
      return false;
    }
    try {
      await saveRecord('event', item);
      setEvents((all) => (all.some((e) => e.id === item.id) ? all.map((e) => (e.id === item.id ? item : e)) : [...all, item]));
      return true;
    } catch (err) {
      if (fromEditor) setEventError(err.message);
      else showToast(err.message);
      return false;
    }
  }

  async function removeEvent(item) {
    if (sampleMode || !window.confirm(`Delete “${eventLabel(item)}” from your calendar?`)) return;
    try {
      await deleteEvent(item.id);
      setEvents((all) => all.filter((e) => e.id !== item.id));
      setEventDraft(null);
      showToast('Removed from your calendar');
    } catch (err) {
      setEventError(err.message);
    }
  }

  /** Dragging a creator follow-up to another day changes the follow-up date on their profile. */
  async function moveFollowUp(creatorId, date) {
    if (sampleMode) {
      showToast('Sample preview is read-only. Switch to My workspace to plan your own week.');
      return;
    }
    const creator = creators.find((c) => c.id === creatorId);
    if (!creator || creator.followUp === date) return;
    const record = {
      ...creator,
      followUp: date,
      history: [`${new Date().toISOString()} | followUp: ${creator.followUp || '—'} → ${date} (calendar)`, ...(creator.history || [])].slice(0, 100),
    };
    try {
      await saveRecord('creator', record);
      setCreators((all) => all.map((c) => (c.id === record.id ? record : c)));
      showToast(`Follow-up with ${creator.firstName} moved to ${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}`);
    } catch (err) {
      showToast(err.message);
    }
  }

  function addToCalendar(date, type) {
    if (sampleMode) setSampleMode(false);
    setEventError('');
    setEventDraft({ value: newEvent(date, type), isNew: true });
  }

  // Reminders: checked every 30 seconds while the workspace is open (any page).
  useEffect(() => {
    const SHOWN_KEY = 'stride-talent-workspace:reminders-shown:v1';
    const check = () => {
      let shown = {};
      try {
        shown = JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}');
      } catch {
        shown = {};
      }
      const due = dueReminders([...events, ...creatorItems(creators)], new Date(), shown);
      if (!due.length) return;
      due.forEach(({ event, key }) => {
        shown[key] = Date.now();
        const when = event.time ? formatTime(event.time) : 'today';
        const label = event.type === 'brand-outreach' ? `${event.brand} for ${event.creatorName}` : eventLabel(event);
        showToast(`Reminder: ${label} · ${when}`);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`Reminder: ${label}`, { body: `${when}${event.notes ? ` · ${event.notes}` : ''}`, tag: key });
          } catch {
            /* some browsers only allow notifications from a service worker */
          }
        }
      });
      // forget reminders older than two days
      const cutoff = Date.now() - 2 * 86_400_000;
      Object.keys(shown).forEach((k) => shown[k] < cutoff && delete shown[k]);
      try {
        localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
      } catch {
        /* not critical */
      }
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [events, creators]);

  const nicheNames = [...new Set(list.map((c) => c.niche).filter(Boolean))].sort();
  const nicheCounts = nicheNames
    .map((name) => ({ name, count: list.filter((c) => c.niche === name).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const completeCount = list.filter((c) => missingDetails(c).length === 0).length;
  const contactedCount = list.filter((c) => c.outreach !== 'Not yet contacted').length;
  const notContactedCount = list.length - contactedCount;
  const dueList = list.filter(isDue);

  // The highlight behind the current page in the menu. It's measured from the active button and springs to the
  // next one when you change page (no spring on first load or when the window is resized).
  const navRef = useRef(null);
  const [indicator, setIndicator] = useState(null);
  const indicatorPlaced = useRef(false);
  const placeIndicator = (animate) => {
    const button = navRef.current?.querySelector('button.active');
    setIndicator(button ? { x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight, animate } : null);
  };
  useLayoutEffect(() => {
    placeIndicator(indicatorPlaced.current);
    indicatorPlaced.current = true;
  }, [view, dueList.length, todayOpenCount]);
  useEffect(() => {
    // Re-measure without the spring when the window changes size or the font finishes loading.
    const onResize = () => placeIndicator(false);
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const approvedCount = list.filter((c) => c.approval === 'Approved').length;
  const incompleteCount = list.length - completeCount;
  const percent = (n) => (list.length ? Math.round((n / list.length) * 100) : 0);

  function matches(c) {
    const q = query.trim().toLowerCase();
    return (
      (filter === 'All creators' ||
        (filter === 'Missing information' && missingDetails(c).length > 0) ||
        (filter === UNDER_MIN_FILTER && isUnderMinimum(c)) ||
        (filter === 'Follow-up needed' && (isDue(c) || c.outreach === filter)) ||
        c.approval === filter ||
        c.outreach === filter ||
        c.fit === filter ||
        (filter === 'Stride Partner referral' && ['Ready to send', 'Sent'].includes(c.partnerStatus))) &&
      (!nicheFilter || c.niche === nicheFilter) &&
      (!ownerFilter || c.owner === ownerFilter) &&
      (!q || searchText(c).includes(q))
    );
  }
  const filtered = list.filter(matches);

  function openCreator(c) {
    setFormError('');
    setDraft(c ? { ...WORKFLOW_DEFAULTS, ...c, calls: c.calls || [] } : { ...EMPTY_CREATOR, id: crypto.randomUUID(), history: [] });
  }

  async function saveCreator(e) {
    e.preventDefault();
    if (!draft) return;
    if (sampleMode) {
      showToast('Sample preview is read-only. Switch to My workspace to add creators.');
      return;
    }
    const problem = validateWorkflow(draft);
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const existing = creators.find((c) => c.id === draft.id);
      const summary = [
        existing
          ? TRACKED_CHANGES.filter((key) => existing[key] !== draft[key])
              .map((key) => `${key}: ${existing[key] || '—'} → ${draft[key] || '—'}`)
              .join(' · ')
          : 'Creator added',
        existing && JSON.stringify(existing.calls || []) !== JSON.stringify(draft.calls) ? 'Call notes updated' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const record = {
        ...draft,
        history: summary ? [`${new Date().toISOString()} | ${summary}`, ...(draft.history || [])].slice(0, 100) : draft.history,
      };
      await saveRecord('creator', record);
      setCreators((all) => (existing ? all.map((c) => (c.id === record.id ? record : c)) : [record, ...all]));
      setDraft(null);
      showToast('Creator saved');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCreator() {
    if (!draft || sampleMode || !window.confirm('Delete this creator permanently?')) return;
    setBusy(true);
    try {
      await deleteCreator(draft.id);
      setCreators((all) => all.filter((c) => c.id !== draft.id));
      setDraft(null);
      showToast('Creator deleted');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(file) {
    if (sampleMode) {
      showToast('Switch to My workspace to import');
      return;
    }
    setImportErrors([]);
    try {
      const plan = planImport(await file.text(), creators);
      if (plan.errors.length) {
        setImportErrors(plan.errors);
        return;
      }
      if (!plan.newRecords.length && !plan.updates.length) {
        showToast(plan.unchanged || plan.duplicatesInFile ? 'Nothing to import: everyone in that file is already up to date' : 'No creators found in that file');
        return;
      }
      setImportPlan({ plan, fileName: file.name });
    } catch (err) {
      showToast(err.message);
    }
  }

  /** Saves what the import window confirmed: new creators and/or chosen updates. */
  async function confirmImport(choice) {
    setBusy(true);
    try {
      const { added, updated } = applyImportPlan(importPlan.plan, choice);
      await saveImport(added, updated);
      setImportPlan(null);
      const parts = [added.length && `${plural(added.length, 'creator')} added`, updated.length && `${plural(updated.length, 'creator')} updated`].filter(Boolean);
      showToast(parts.join(' · ') || 'Nothing changed');
    } catch (err) {
      showToast(err.message);
    } finally {
      await load();
      setBusy(false);
    }
  }

  async function saveTemplate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveRecord('template', templateDraft);
      setTemplates((all) =>
        all.some((t) => t.id === templateDraft.id) ? all.map((t) => (t.id === templateDraft.id ? templateDraft : t)) : [...all, templateDraft],
      );
      setTemplateDraft(null);
      showToast('Template saved');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const copyText = (text, success, failure) =>
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(success))
      .catch(() => showToast(failure));

  const input = (key, label, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        value={String(draft?.[key] ?? '')}
        required={key === 'firstName'}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 1 : undefined}
        placeholder={key === 'followers' ? 'Unknown' : key === 'instagram' || key === 'tiktok' ? 'https://…' : label}
        onChange={(e) => setDraft((d) => d && { ...d, [key]: e.target.value })}
      />
    </label>
  );

  function creatorTable(rows) {
    return (
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>CREATOR</th>
              <th>NICHE</th>
              <th>FOLLOWERS</th>
              <th>ENGAGEMENT</th>
              <th>FIT</th>
              <th>APPROVAL</th>
              <th>OUTREACH</th>
              <th>OWNER</th>
              <th>FOLLOW-UP</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} tabIndex={0} onClick={() => openCreator(c)} onKeyDown={(e) => e.key === 'Enter' && openCreator(c)}>
                <td>
                  <div className="person">
                    <span className={`avatar a${i % 5}`}>
                      {c.firstName?.[0]}
                      {c.lastName?.[0]}
                    </span>
                    <span>
                      <strong>
                        {c.firstName} {c.lastName}
                      </strong>
                      <small>{c.email || 'Email missing'}</small>
                    </span>
                  </div>
                </td>
                <td>{c.niche || <span className="muted">Not added</span>}</td>
                <td>
                  <strong>{formatFollowers(c.followers)}</strong>
                  {isUnderMinimum(c) && <small className="under">Below minimum</small>}
                </td>
                <td>{c.engagementRate !== '' && c.engagementRate !== undefined ? `${c.engagementRate}%` : '—'}</td>
                <td>
                  <Badge value={c.fit || 'Pending assessment'} />
                </td>
                <td>
                  <Badge value={c.approval} />
                </td>
                <td>
                  <Badge value={c.outreach} />
                </td>
                <td>
                  <span className="ownerDot">{c.owner?.[0] || '?'}</span>
                  {c.owner || 'Unassigned'}
                </td>
                <td className={isDue(c) ? 'due' : ''}>
                  {c.followUp || '—'}
                  {isDue(c) && <small>Due now</small>}
                </td>
                <td>
                  <button className="icon" aria-label={`Edit ${c.firstName}`}>
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty">
            <Users size={28} />
            <h3>{list.length ? 'No creators match these filters' : 'Your next great partnership starts here'}</h3>
            <p>{list.length ? 'Try another search or clear your filters.' : 'Add your first creator or import a CSV to start building your roster.'}</p>
            <button onClick={() => (list.length ? goTo('Creators') : openCreator())}>
              {list.length ? 'Clear filters' : '+ Add your first creator'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const [title, subtitle] = HEADINGS[view];
  const missing = draft ? missingDetails(draft) : [];
  const draftIsSaved = draft ? creators.some((c) => c.id === draft.id) : false;
  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="app">
      <div
        className={`backdrop${look.glass && appearance.background === 'theme' ? ' glassBackdrop' : ''}${look.motion ? ' moving' : ''}`}
        style={look.backdrop}
        aria-hidden="true"
      >
        {look.tint && <div className="backdropTint" style={look.tint} />}
        {look.motion && <GlassBackdrop mode={mode} />}
      </div>
      <aside>
        <a
          className="brand"
          href="#/overview"
          onClick={(e) => {
            e.preventDefault();
            goTo('Overview');
          }}
        >
          stride<span>talent</span>
          <i>↗</i>
        </a>
        <div className="workspaceLabel">CREATOR WORKSPACE</div>
        <nav ref={navRef}>
          <span
            className={`navIndicator${indicator?.animate ? ' ready' : ''}`}
            aria-hidden="true"
            style={
              indicator
                ? { transform: `translate(${indicator.x}px, ${indicator.y}px)`, width: indicator.width, height: indicator.height }
                : { opacity: 0 }
            }
          />
          {VIEWS.map((v) => {
            const Icon = NAV_ICONS[v];
            return (
              <button key={v} className={view === v ? 'active' : ''} aria-current={view === v ? 'page' : undefined} onClick={() => goTo(v)}>
                <Icon size={18} />
                {v}
                {v === 'Follow-ups' && dueList.length > 0 && <b>{dueList.length}</b>}
                {v === CALENDAR && todayOpenCount > 0 && <b title="Open items today">{todayOpenCount}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sideTools" role="group" aria-label="Workspace tools">
          <button onClick={() => setBackupOpen(true)} aria-label="Back up or restore your data">
            <DatabaseBackup size={17} />
            Backup
          </button>
          <button onClick={() => setPersonalizeOpen(true)} aria-label="Personalize colours and background">
            <Palette size={17} />
            Personalize
          </button>
          <button
            onClick={() => (lock.enabled ? lock.lockNow() : setSecurityOpen(true))}
            title={lock.enabled ? 'Lock now' : 'Protect the workspace with a password'}
          >
            <Lock size={17} />
            {lock.enabled ? 'Lock now' : 'Set password'}
          </button>
        </div>
        <div className="sidecard">
          <div className="leaf">
            <Leaf size={19} />
          </div>
          <strong>
            Big potential.
            <br />A different path.
          </strong>
          <p>
            Under {MIN_FOLLOWERS_LABEL} followers?
            <br />
            There’s a place in Stride Suite.
          </p>
          <button onClick={() => goTo('Creators', 'Stride Suite referral')}>
            View referrals <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="profile">
          <span className="avatar">MS</span>
          <div>
            <strong>Michelle</strong>
            <small>Talent manager</small>
          </div>
          <span className="online" />
        </div>
      </aside>

      <main>
        <header>
          <span>
            Workspace <ChevronRight size={13} /> <b>{view}</b>
          </span>
          <div className="headerRight">
            <button
              className="modeToggle"
              onClick={() => setAppearance((a) => ({ ...a, mode: mode === 'dark' ? 'light' : 'dark' }))}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button className="private" onClick={() => setSecurityOpen(true)} title="Password & lock settings">
              <i />
              {lock.enabled ? 'Password protected' : 'Private workspace'}
            </button>
            <span className="miniAvatar">M</span>
          </div>
        </header>

        <div className="content" key={view}>
          <div className="heading">
            <div>
              <div className="eyebrow">STRIDE TALENT / {view.toUpperCase()}</div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {view === CALENDAR ? (
              <button className="primary" onClick={() => addToCalendar(today(), 'task')}>
                <Plus size={17} />
                Add to calendar
              </button>
            ) : view === TREND_REPORT ? (
              <button
                className="primary"
                onClick={() => copyText(trendReportTemplate, 'Weekly trend report template copied', 'Clipboard unavailable; select the text and copy it.')}
              >
                <Copy size={17} />
                Copy template
              </button>
            ) : view === 'Templates' ? (
              <button
                className="primary"
                onClick={() => {
                  setFormError('');
                  setTemplateDraft({ id: crypto.randomUUID(), title: '', body: '' });
                }}
              >
                <Plus size={17} />
                New template
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => {
                  if (sampleMode) setSampleMode(false);
                  openCreator();
                }}
              >
                <Plus size={17} />
                Add creator
              </button>
            )}
          </div>

          <div className="modebar">
            <div>
              <span className={`liveDot ${sampleMode ? 'sample' : ''}`} />
              {sampleMode ? (
                <>
                  <b>Sample preview</b>
                  <span>Fictional creators · changes are not saved</span>
                </>
              ) : (
                <>
                  <b>My workspace</b>
                  <span>{loading ? 'Loading…' : `${plural(creators.length, 'saved creator')}`}</span>
                </>
              )}
            </div>
            <div className="modebarActions">
              {fileStatus.error && (
                <button className="backupNudge warn" onClick={() => setBackupOpen(true)}>
                  <TriangleAlert size={13} />
                  Not saved to file
                </button>
              )}
              {!sampleMode && needsBackup({ hasData: creators.length > 0 || events.length > 0, lastBackup }) && (
                <button className="backupNudge" onClick={() => setBackupOpen(true)}>
                  <DatabaseBackup size={13} />
                  {lastBackup ? 'Time for a backup' : 'Back up your data'}
                </button>
              )}
            </div>
          </div>

          {loadError && (
            <div className="error">
              {loadError} <button onClick={load}>Retry</button>
            </div>
          )}

          <div className="rule">
            <span className="ruleIcon">
              <CircleCheck size={18} />
            </span>
            <b>Talent starts at {MIN_FOLLOWERS_LABEL} followers.</b>
            <span>Below the minimum? Keep the connection through Stride Suite.</span>
            <button onClick={() => goTo('Creators', UNDER_MIN_FILTER)}>
              Review eligibility <ArrowRight size={15} />
            </button>
          </div>

          {view === 'Overview' && (
            <>
              <div className="stats">
                <button onClick={() => goTo('Creators')}>
                  <span>
                    Total creators <Users size={17} />
                  </span>
                  <strong>
                    <CountUp value={list.length} />
                    <small>in your network</small>
                  </strong>
                  <footer>
                    <span className="greenText">{approvedCount} approved</span> for Stride Talent
                  </footer>
                </button>
                <button onClick={() => goTo('Creators', 'Missing information')}>
                  <span>
                    Enrichment progress <SlidersHorizontal size={17} />
                  </span>
                  <strong>
                    <CountUp value={percent(completeCount)} />
                    <em>%</em>
                    <small>
                      {completeCount} of {list.length} complete
                    </small>
                  </strong>
                  <div className="progress">
                    <i style={{ width: `${percent(completeCount)}%` }} />
                  </div>
                </button>
                <button onClick={() => goTo('Creators', 'Contacted')}>
                  <span>
                    Outreach progress <MessageSquare size={17} />
                  </span>
                  <strong>
                    <CountUp value={percent(contactedCount)} />
                    <em>%</em>
                    <small>
                      {contactedCount} of {list.length} contacted
                    </small>
                  </strong>
                  <div className="progress blueProgress">
                    <i style={{ width: `${percent(contactedCount)}%` }} />
                  </div>
                </button>
                <button onClick={() => goTo('Follow-ups')}>
                  <span>
                    Follow-ups due <Clock3 size={17} />
                  </span>
                  <strong>
                    <CountUp value={dueList.length} />
                    <small>ready for your next move</small>
                  </strong>
                  <footer className="orangeText">
                    {dueList.length ? 'A thoughtful nudge goes a long way' : 'You’re all caught up'} <ArrowUpRight size={14} />
                  </footer>
                </button>
              </div>

              <div className="panels">
                <section className="panel focus">
                  <div className="panelHead">
                    <h2>
                      Your next moves <span>MAKE IT HAPPEN</span>
                    </h2>
                    <Clock3 size={18} />
                  </div>
                  <button onClick={() => goTo('Follow-ups')}>
                    <span className="taskIcon orangeIcon">
                      <Clock3 size={18} />
                    </span>
                    <div>
                      <b>Pick up the conversation</b>
                      <p>{plural(dueList.length, 'follow-up')} due today or overdue</p>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                  <button onClick={() => goTo('Creators', 'Missing information')}>
                    <span className="taskIcon blueIcon">
                      <Users size={18} />
                    </span>
                    <div>
                      <b>Fill in the missing pieces</b>
                      <p>
                        {plural(incompleteCount, 'creator profile')} {incompleteCount === 1 ? 'needs' : 'need'} more information
                      </p>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                  <button onClick={() => goTo('Creators', 'Not yet contacted')}>
                    <span className="taskIcon greenIcon">
                      <MessageSquare size={18} />
                    </span>
                    <div>
                      <b>Make the first connection</b>
                      <p>
                        {plural(notContactedCount, 'creator')} {notContactedCount === 1 ? 'hasn’t' : 'haven’t'} been contacted yet
                      </p>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                </section>

                <section className="panel nichepanel">
                  <div className="panelHead">
                    <h2>A world of talent</h2>
                    <span>BY NICHE</span>
                  </div>
                  {nicheCounts.length ? (
                    <>
                      {nicheCounts.slice(0, 5).map(({ name, count }, i) => (
                        <button
                          key={name}
                          className="nicheRow"
                          onClick={() => {
                            goTo('Creators');
                            setNicheFilter(name);
                          }}
                        >
                          <div>
                            <span>
                              <i style={{ background: NICHE_COLORS[i] }} />
                              {name}
                            </span>
                            <b>{count}</b>
                          </div>
                          <div className="nicheBar">
                            <i style={{ width: `${(count / list.length) * 100}%`, background: NICHE_COLORS[i] }} />
                          </div>
                        </button>
                      ))}
                      {nicheCounts.length > 5 && (
                        <button className="nicheMore" onClick={() => goTo('Creators')}>
                          + {plural(nicheCounts.length - 5, 'more niche')} <ArrowRight size={13} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="nicheEmpty">
                      <div className="rings">✳</div>
                      <p>
                        Your niches will appear here
                        <br />
                        as your creator network grows.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              <section className="panel database">
                <div className="panelHead">
                  <h2>
                    Creator spotlight <span>{plural(list.length, 'CREATOR', 'CREATORS')}</span>
                  </h2>
                  <button onClick={() => goTo('Creators')}>
                    View all creators <ArrowRight size={15} />
                  </button>
                </div>
                {creatorTable(list.slice(0, 5))}
              </section>
            </>
          )}

          {(view === 'Creators' || view === 'Follow-ups') && (
            <section className="panel database">
              <div className="toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search creators"
                    placeholder="Search names, emails, brands, notes…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select aria-label="Filter by niche" value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)}>
                  <option value="">All niches</option>
                  {nicheNames.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <select aria-label="Filter by owner" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                  <option value="">All owners</option>
                  {[...new Set(list.map((c) => c.owner).filter(Boolean))].map((owner) => (
                    <option key={owner}>{owner}</option>
                  ))}
                </select>
                <button onClick={() => downloadCsv(creatorsToCsv(filtered), 'stride-creators.csv')}>
                  <Download size={16} />
                  Export CSV
                </button>
                <button disabled={busy} onClick={() => fileInput.current?.click()}>
                  <Upload size={16} />
                  Import CSV
                </button>
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) importCsv(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </div>

              {importErrors.length > 0 && (
                <div className="error importErrors" role="alert">
                  <b>Nothing was imported. Fix {importErrors.length === 1 ? 'this row' : 'these rows'} and try again:</b>
                  <ul>
                    {importErrors.slice(0, 8).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                  {importErrors.length > 8 && <p>…and {plural(importErrors.length - 8, 'more row')}.</p>}
                  <button onClick={() => setImportErrors([])}>Dismiss</button>
                </div>
              )}

              <div className="filters">
                {FILTERS.map((name) => (
                  <button key={name} className={filter === name ? 'chosen' : ''} onClick={() => setFilter(name)}>
                    {name}
                  </button>
                ))}
              </div>
              <div className="resultcount">
                {plural(filtered.length, 'creator')} <span>Click a creator to review their full profile</span>
              </div>
              {creatorTable(filtered)}
            </section>
          )}

          {view === 'Templates' && (
            <>
              <div className="templateHint">
                <MessageSquare size={18} />
                <div>
                  <b>A starting point for every conversation.</b>
                  <p>
                    Use {'{{firstName}}'}, {'{{owner}}'} and {'{{deckLink}}'} (the creator’s signing deck) for personalisation. Copy from a
                    creator’s profile to fill them automatically. Messages are never sent automatically.
                  </p>
                </div>
              </div>
              <div className="templates">
                {templates.map((t) => (
                  <article key={t.id} className="panel template">
                    <div className="templateTop">
                      <span>
                        <MessageSquare size={20} />
                      </span>
                      <button
                        onClick={() => {
                          setFormError('');
                          setTemplateDraft({ ...t });
                        }}
                      >
                        Edit <ArrowUpRight size={15} />
                      </button>
                    </div>
                    <h2>{t.title}</h2>
                    <p>{t.body}</p>
                    <button className="copy" onClick={() => copyText(t.body, 'Template copied', 'Clipboard unavailable; select and copy the text.')}>
                      <Copy size={16} />
                      Copy template
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}

          {view === CALENDAR && (
            <CalendarPage
              key={dataVersion}
              events={calendarEvents}
              creators={list}
              readOnly={sampleMode}
              notify={showToast}
              onSave={(item) => saveEvent(item)}
              onMoveFollowUp={moveFollowUp}
              onOpenCreator={openCreator}
              onEdit={(value) => {
                setEventError('');
                setEventDraft({ value, isNew: !calendarEvents.some((e) => e.id === value.id) });
              }}
            />
          )}

          {view === TREND_REPORT && (
            <section className="panel trendTemplate">
              <div className="panelHead">
                <h2>
                  Report template <span>{trendReportTemplate.split('\n').length} LINES</span>
                </h2>
                <button
                  onClick={() => copyText(trendReportTemplate, 'Weekly trend report template copied', 'Clipboard unavailable; select the text and copy it.')}
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
              <pre>{trendReportTemplate}</pre>
            </section>
          )}

          {view === 'Pricing' && (
            <>
              <section className="panel pricingPanel">
                <PricingCalculator values={pricingViews} onChange={(patch) => setPricingViews((v) => ({ ...v, ...patch }))} />
              </section>
              <div className="pricingLower">
                <section className="panel pricingInfo">
                  <PricingNotes />
                </section>
                <section className="panel pricingInfo howTo">
                  <h3>How to use it</h3>
                  <ol>
                    <li>
                      <b>Enter average views</b> from the creator’s recent posts on each platform.
                    </li>
                    <li>
                      <b>Read the recommended rate.</b> It updates as you type.
                    </li>
                    <li>
                      <b>Start the negotiation there</b>, then adjust for engagement and extras.
                    </li>
                  </ol>
                  <p className="help">To keep an estimate with a creator, open their profile and use “Rate estimate”.</p>
                  <a className="guideLink" href={PRICING_CALCULATOR_PAGE} target="_blank" rel="noreferrer">
                    Open Stride’s pricing calculator ↗
                  </a>
                </section>
              </div>
            </>
          )}

          <details className="workspaceGuide">
            <summary>Workspace reference · how this workflow fits together</summary>
            <p>
              <b>Assess:</b> review followers, engagement rate, source/date and creator fit. Talent approval still requires{' '}
              {MIN_FOLLOWERS_LABEL} followers. Fit and approval are separate from outreach stage.
            </p>
            <p>
              <b>Progress:</b> contacted → replied → call booked → call completed → contract sent → contract signed. Use follow-up dates for
              your next action.
            </p>
            <p>
              <b>Confirm:</b> Google Calendar is the booking source, matched by creator email. Gmail supplies context. A proposed time
              remains pending until confirmed in Calendar. Current checks are manual, not live sync.
            </p>
            <p>
              <b>Discuss:</b> log brand-deal experience, frequency, quoted rates, actual payment, best month, deal source, challenges and
              goals. Agree how Stride can help and set the next step.
            </p>
            <p>
              <b>Close:</b> signed creators move to Stride OS through the Onboarding Talent link. Non-signing creators can receive the
              Partnered link. Under-minimum Stride Suite referrals remain a separate path. Both links are in each creator’s “After the
              decision” section.
            </p>
            <p>
              <b>Present:</b> each creator profile suggests a signing deck from their niche, and uses the general Talent deck when the
              niche is unclear. Estimate rates from average views on the Pricing page or in the profile.
            </p>
            <a href={CALL_GUIDE_URL} target="_blank" rel="noreferrer">
              Open full call guide ↗
            </a>{' '}
            <a href={SIGNING_DECKS_PAGE} target="_blank" rel="noreferrer">
              Signing decks ↗
            </a>{' '}
            <a href={PRICING_CALCULATOR_PAGE} target="_blank" rel="noreferrer">
              Pricing calculator ↗
            </a>{' '}
            <a href={ONBOARDING_LINK} target="_blank" rel="noreferrer">
              Onboarding Talent link ↗
            </a>{' '}
            <a href={PARTNERED_LINK} target="_blank" rel="noreferrer">
              Partnered link ↗
            </a>
          </details>
          <p className="scopeNote">
            Outreach → call → contract signature. Signed creators continue in Stride OS; creators who do not sign can be referred to Stride
            Partner.
          </p>
          <footer className="foot">
            <span>Built for meaningful connections.</span>
            <b>stride talent ↗</b>
          </footer>
        </div>
      </main>

      {draft && (
        <div className="overlay" onClick={() => !busy && setDraft(null)}>
          <section className="drawer" role="dialog" aria-modal="true" aria-label="Creator profile" onClick={(e) => e.stopPropagation()}>
            <div className="drawerHead">
              <div>
                <span className="eyebrow">CREATOR PROFILE</span>
                <h2>{draft.firstName ? `${draft.firstName} ${draft.lastName}` : 'A new connection'}</h2>
              </div>
              <button className="icon" aria-label="Close profile" onClick={() => setDraft(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={saveCreator}>
              <div className="drawerBody">
                {sampleMode && <div className="notice">Sample profile · read-only preview</div>}
                <h3>The essentials</h3>
                <div className="formgrid">
                  {input('firstName', 'First name *')}
                  {input('lastName', 'Last name')}
                  {input('email', 'Email', 'email')}
                  {input('niche', 'Niche')}
                  {input('followers', 'Follower count', 'number')}
                  {input('owner', 'Assigned owner')}
                  {input('instagram', 'Instagram', 'url')}
                  {input('tiktok', 'TikTok', 'url')}
                </div>
                <div className="socialLinks">
                  {[
                    ['instagram', 'Instagram'],
                    ['tiktok', 'TikTok'],
                  ].map(
                    ([key, label]) =>
                      /^https:\/\//.test(draft[key] || '') && (
                        <a key={key} href={draft[key]} target="_blank" rel="noreferrer">
                          Open {label} <ExternalLink size={13} />
                        </a>
                      ),
                  )}
                </div>
                <div className="completeness">
                  <b>{missing.length ? `${plural(missing.length, 'detail')} to enrich` : 'Profile complete'}</b>
                  <span>{missing.join(' · ')}</span>
                </div>

                <CallWorkflow
                  key={draft.id}
                  value={draft}
                  readOnly={sampleMode}
                  notify={showToast}
                  onChange={(patch) => setDraft((d) => d && { ...d, ...patch })}
                />

                <h3>Recent collaboration</h3>
                <div className="formgrid">
                  {input('brand', 'Brand')}
                  {input('collabDate', 'Collaboration date', 'date')}
                </div>

                <h3>Review &amp; outreach</h3>
                <div className="eligibility">
                  {!hasFollowerCount(draft)
                    ? 'Add a follower count to check eligibility.'
                    : isUnderMinimum(draft)
                      ? `Below the ${MIN_FOLLOWERS_LABEL}-follower minimum. Consider Stride Suite.`
                      : `Meets the ${MIN_FOLLOWERS_LABEL}-follower minimum. Ready for your review.`}
                  {isUnderMinimum(draft) && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          approval: 'Stride Suite referral',
                          reason: `Below the ${MIN_FOLLOWERS_LABEL}-follower minimum for Stride Talent.`,
                        })
                      }
                    >
                      Route to Stride Suite <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                <div className="formgrid">
                  <label>
                    Approval status
                    <select value={draft.approval} onChange={(e) => setDraft({ ...draft, approval: e.target.value })}>
                      {APPROVAL_OPTIONS.map((option) => (
                        <option
                          key={option}
                          disabled={option === 'Approved' && (!hasFollowerCount(draft) || Number(draft.followers) < MIN_FOLLOWERS)}
                        >
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pipeline stage
                    <select value={draft.outreach} onChange={(e) => setDraft({ ...draft, outreach: e.target.value })}>
                      {PIPELINE_STAGES.filter((stage) => !LEGACY_STAGES.includes(stage) || stage === draft.outreach).map((stage) => (
                        <option key={stage} value={stage}>
                          {LEGACY_STAGES.includes(stage) ? `${stage} (legacy)` : stage}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="full">
                    Decision reason
                    <input
                      value={draft.reason}
                      required={draft.approval !== 'Needs review'}
                      placeholder="Why is this creator a fit, declined, or referred?"
                      onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                    />
                  </label>
                  {input('followUp', 'Follow-up date', 'date')}
                </div>
                <label className="notes">
                  Outreach notes
                  <textarea
                    rows={4}
                    value={draft.notes}
                    placeholder="Content fit, conversation notes, next steps…"
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  />
                </label>

                <h3>Start a conversation</h3>
                <select aria-label="Outreach template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <textarea
                  className="generated"
                  aria-label="Personalised message preview"
                  readOnly
                  rows={6}
                  value={personalise(selectedTemplate?.body, draft)}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    copyText(personalise(selectedTemplate?.body, draft), 'Personalised message copied', 'Select the message above to copy it')
                  }
                >
                  <Copy size={15} />
                  Copy personalised message
                </button>
                <small className="help">Replace any bracketed placeholders before sending. Update outreach status after you send.</small>

                {draft.history?.length > 0 && (
                  <>
                    <h3>Activity history</h3>
                    <div className="history">
                      {draft.history.map((entry, i) => (
                        <p key={i}>{entry}</p>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="drawerFoot">
                {formError && (
                  <span role="alert" className="saveError">
                    {formError}
                  </span>
                )}
                {draftIsSaved && !sampleMode && (
                  <button type="button" className="icon delete" aria-label="Delete creator" onClick={removeCreator} disabled={busy}>
                    <Trash2 size={17} />
                  </button>
                )}
                <button type="button" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="primary" disabled={busy || sampleMode}>
                  {busy ? 'Saving…' : 'Save creator'}
                  <Check size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {templateDraft && (
        <div className="overlay" onClick={() => setTemplateDraft(null)}>
          <section className="templateModal" role="dialog" aria-modal="true" aria-label="Edit template" onClick={(e) => e.stopPropagation()}>
            <div className="drawerHead">
              <h2>{templateDraft.title || 'New template'}</h2>
              <button className="icon" aria-label="Close template" onClick={() => setTemplateDraft(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={saveTemplate}>
              <label>
                Template title
                <input required value={templateDraft.title} onChange={(e) => setTemplateDraft({ ...templateDraft, title: e.target.value })} />
              </label>
              <label>
                Message
                <textarea rows={13} required value={templateDraft.body} onChange={(e) => setTemplateDraft({ ...templateDraft, body: e.target.value })} />
              </label>
              <p className="help">
                Personalisation: {'{{firstName}}'} · {'{{owner}}'} · {'{{deckLink}}'}
              </p>
              {formError && <p className="error">{formError}</p>}
              <button className="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save template'}
              </button>
            </form>
          </section>
        </div>
      )}

      {importPlan && (
        <ImportDialog
          plan={importPlan.plan}
          fileName={importPlan.fileName}
          busy={busy}
          onConfirm={confirmImport}
          onClose={() => !busy && setImportPlan(null)}
        />
      )}

      {securityOpen && (
        <SecurityPanel
          onClose={() => setSecurityOpen(false)}
          notify={showToast}
          onOpenBackup={() => {
            setSecurityOpen(false);
            setBackupOpen(true);
          }}
        />
      )}

      {backupOpen && (
        <BackupPanel
          lastBackup={lastBackup}
          onBackedUp={setLastBackup}
          onRestored={afterRestore}
          onClose={() => setBackupOpen(false)}
          notify={showToast}
        />
      )}

      {eventDraft && (
        <EventEditor
          value={eventDraft.value}
          isNew={eventDraft.isNew}
          creators={list}
          readOnly={sampleMode}
          error={eventError}
          busy={busy}
          onChange={(value) => setEventDraft((d) => d && { ...d, value })}
          onSave={async (value) => {
            setEventError('');
            if (await saveEvent(value, { fromEditor: true })) {
              showToast(eventDraft.isNew ? 'Added to your calendar' : 'Calendar item saved');
              setEventDraft(null);
            }
          }}
          onDelete={() => removeEvent(eventDraft.value)}
          onClose={() => setEventDraft(null)}
        />
      )}

      {personalizeOpen && (
        <Personalize
          value={appearance}
          mode={mode}
          error={appearanceError}
          onChange={(patch) => setAppearance((a) => ({ ...a, ...patch }))}
          onReset={() => setAppearance({ ...DEFAULT_APPEARANCE })}
          onClose={() => setPersonalizeOpen(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
