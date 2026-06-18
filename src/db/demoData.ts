/**
 * Demo workspace with realistic transaction data.
 *
 * Requirement: A pre-populated workspace rich enough to exercise EVERY analytical
 *   feature — forecasting (trend + day-of-week seasonality), the rolling-origin
 *   backtest (needs ~26 weekly origins), cash runway, and recurring-pattern
 *   detection across all cadences and variabilities.
 * Approach: Deterministically generate ~12 months of daily-spread transactions on
 *   first app load (empty DB). Amounts are signed (positive = income, negative =
 *   expense). Patterns are computed FROM the generated transactions so the seeded
 *   pattern stats (expected amount, std-dev, last-seen) always match the data.
 *   Jitter is keyed by calendar date, so the same day always renders identically
 *   while still giving the forecaster realistic noise to learn from.
 * Coverage: daily (weekday coffee), weekly (groceries, fuel), biweekly (freelance),
 *   monthly (salary, rent, subscriptions, utilities), quarterly (provisional tax,
 *   car service), annually (licence, hosting), irregular (prepaid electricity,
 *   data bundles); fixed / variable / irregular variability; plus once-off shocks
 *   (laptop, flights, dental) and a mid-history salary raise for a visible trend.
 * Alternatives:
 *   - 2 months of monthly-only data (previous seed): Rejected — too thin for the
 *     backtest, day-of-week seasonality, or cadence variety; runway/accuracy were
 *     not meaningfully testable.
 *   - Load from external JSON: Rejected — adds latency, fails offline on first visit.
 */

import { db } from './index'
import { debugLog } from '@/debug/debugLog'
import { touchTags } from '@/composables/useTagAutocomplete'
import { safeSetItem } from '@/composables/useSafeStorage'
import type { Workspace, Transaction, RecurringPattern } from '@/types/models'

const DEMO_WORKSPACE_ID = 'demo-household'

/** Months of history to generate (12 saturates the 26-origin weekly backtest). */
const HISTORY_MONTHS = 12

function makeId(suffix: string): string {
  return `demo-${suffix}`
}

function makeTransaction(
  id: string,
  date: string,
  amount: number,
  description: string,
  tags: string[],
  classification: Transaction['classification'],
  recurringGroupId: string | null,
): Transaction {
  const now = new Date().toISOString()
  return {
    id: makeId(id),
    workspaceId: DEMO_WORKSPACE_ID,
    date,
    amount,
    description,
    tags,
    source: 'import',
    classification,
    recurringGroupId: recurringGroupId ? makeId(recurringGroupId) : null,
    originalRow: null,
    importBatchId: null,
    createdAt: now,
    updatedAt: now,
  }
}

function makePattern(
  id: string,
  description: string,
  expectedAmount: number,
  frequency: RecurringPattern['frequency'],
  anchorDay: number,
  tags: string[],
  lastSeenDate: string,
  variability: RecurringPattern['variability'],
  amountStdDev: number,
): RecurringPattern {
  const now = new Date().toISOString()
  return {
    id: makeId(id),
    workspaceId: DEMO_WORKSPACE_ID,
    description,
    expectedAmount,
    amountStdDev,
    frequency,
    anchorDay,
    tags,
    variability,
    isActive: true,
    autoAccept: true,
    lastSeenDate,
    createdAt: now,
    updatedAt: now,
  }
}

// ── Deterministic helpers ───────────────────────────────────────────
// FNV-1a string hash → [0,1). Keyed by calendar date so the demo is stable per
// day but varies across days (realistic noise the forecaster can actually learn).
function rand(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/** Jitter a base amount by ±spread (fraction of base), deterministically keyed. */
function jitter(base: number, spread: number, key: string): number {
  return Math.round(base * (1 + (rand(key) - 0.5) * 2 * spread))
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function daysInMonth(y: number, month0: number): number {
  return new Date(y, month0 + 1, 0).getDate()
}
function meanOf(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function stdOf(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = meanOf(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

// ── Recurring-group specs (pattern metadata) ────────────────────────
// expectedAmount + amountStdDev + lastSeenDate are computed from the generated
// transactions; everything else (cadence, anchor, variability, tags) lives here.
interface GroupSpec {
  description: string
  frequency: RecurringPattern['frequency']
  /** Monthly/quarterly/annually: day-of-month. Weekly/biweekly: day-of-week (0=Sun). Daily/irregular: 0. */
  anchorDay: number
  variability: RecurringPattern['variability']
  tags: string[]
}

const SPECS: Record<string, GroupSpec> = {
  // Income
  salary: { description: 'Salary', frequency: 'monthly', anchorDay: 25, variability: 'fixed', tags: ['Income', 'FNB Cheque'] },
  freelance: { description: 'Freelance project', frequency: 'biweekly', anchorDay: 4, variability: 'variable', tags: ['Income', 'Capitec'] },
  // Monthly fixed
  rent: { description: 'Rent transfer', frequency: 'monthly', anchorDay: 1, variability: 'fixed', tags: ['Housing'] },
  insurance: { description: 'MiWay car insurance', frequency: 'monthly', anchorDay: 2, variability: 'fixed', tags: ['Insurance'] },
  medical: { description: 'Discovery medical aid', frequency: 'monthly', anchorDay: 3, variability: 'fixed', tags: ['Medical'] },
  gym: { description: 'Virgin Active debit order', frequency: 'monthly', anchorDay: 1, variability: 'fixed', tags: ['Health'] },
  internet: { description: 'Vumatel fibre', frequency: 'monthly', anchorDay: 3, variability: 'fixed', tags: ['Housing'] },
  netflix: { description: 'Netflix subscription', frequency: 'monthly', anchorDay: 2, variability: 'fixed', tags: ['Entertainment'] },
  spotify: { description: 'Spotify subscription', frequency: 'monthly', anchorDay: 2, variability: 'fixed', tags: ['Entertainment'] },
  // Monthly variable
  utilities: { description: 'City of Cape Town utilities', frequency: 'monthly', anchorDay: 7, variability: 'variable', tags: ['Housing'] },
  water: { description: 'City of CT water', frequency: 'monthly', anchorDay: 10, variability: 'variable', tags: ['Housing'] },
  // Weekly
  groceries: { description: 'Weekly groceries', frequency: 'weekly', anchorDay: 6, variability: 'variable', tags: ['Food'] },
  fuel: { description: 'Fuel', frequency: 'weekly', anchorDay: 3, variability: 'variable', tags: ['Transport'] },
  // Daily
  coffee: { description: 'Coffee & snacks', frequency: 'daily', anchorDay: 0, variability: 'variable', tags: ['Food', 'Discretionary'] },
  // Quarterly
  tax: { description: 'SARS provisional tax', frequency: 'quarterly', anchorDay: 20, variability: 'fixed', tags: ['Tax'] },
  service: { description: 'Car service & maintenance', frequency: 'quarterly', anchorDay: 15, variability: 'variable', tags: ['Transport'] },
  // Annually
  licence: { description: 'Car licence renewal', frequency: 'annually', anchorDay: 12, variability: 'fixed', tags: ['Transport'] },
  hosting: { description: 'Domain + hosting renewal', frequency: 'annually', anchorDay: 8, variability: 'fixed', tags: ['Subscriptions'] },
  // Irregular (on-demand) — projected as a daily rate from linked history
  'prepaid-elec': { description: 'Prepaid electricity', frequency: 'irregular', anchorDay: 0, variability: 'irregular', tags: ['Housing'] },
  data: { description: 'Vodacom data bundle', frequency: 'irregular', anchorDay: 0, variability: 'irregular', tags: ['Connectivity'] },
}

/**
 * Build the full demo dataset (transactions + patterns) for a given "today".
 * Patterns are derived from the generated transactions so the two never drift.
 */
function buildDemoData(baseDate: Date): { transactions: Transaction[]; patterns: RecurringPattern[] } {
  const txns: Transaction[] = []
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  const start = new Date(today.getFullYear(), today.getMonth() - HISTORY_MONTHS, 1)
  const inRange = (d: Date) => d >= start && d <= today

  // Per-group running stats, used to compute pattern expectedAmount/std/lastSeen.
  const stats = new Map<string, { amounts: number[]; lastSeen: string }>()

  const addRecurring = (idPrefix: string, d: Date, amount: number, group: string, description?: string) => {
    if (!inRange(d)) return
    const spec = SPECS[group]!
    txns.push(makeTransaction(`${idPrefix}-${iso(d)}`, iso(d), amount, description ?? spec.description, spec.tags, 'recurring', group))
    const s = stats.get(group) ?? { amounts: [], lastSeen: '' }
    s.amounts.push(amount)
    if (iso(d) > s.lastSeen) s.lastSeen = iso(d)
    stats.set(group, s)
  }
  const addOnce = (idPrefix: string, d: Date, amount: number, description: string, tags: string[]) => {
    if (!inRange(d)) return
    txns.push(makeTransaction(`${idPrefix}-${iso(d)}`, iso(d), amount, description, tags, 'once-off', null))
  }

  const monthKey = (y: number, m0: number) => `${y}-${m0}`
  const onDay = (y: number, m0: number, day: number, idPrefix: string, amount: number, group: string, description?: string) =>
    addRecurring(idPrefix, new Date(y, m0, Math.min(day, daysInMonth(y, m0))), amount, group, description)

  // ── Monthly / quarterly items ──
  const grossMonths = HISTORY_MONTHS + 1 // include the partial current month
  for (let mi = 0; mi < grossMonths; mi++) {
    const mDate = new Date(start.getFullYear(), start.getMonth() + mi, 1)
    const y = mDate.getFullYear()
    const m0 = mDate.getMonth()
    if (mDate > today) break
    const k = monthKey(y, m0)
    const monthsAgo = (today.getFullYear() * 12 + today.getMonth()) - (y * 12 + m0)

    // Income — salary with a raise in the most recent 6 months (visible upward trend)
    onDay(y, m0, SPECS.salary!.anchorDay, 'salary', monthsAgo <= 5 ? 30500 : 28500, 'salary')

    // Fixed monthly expenses
    onDay(y, m0, SPECS.rent!.anchorDay, 'rent', -12500, 'rent')
    onDay(y, m0, SPECS.insurance!.anchorDay, 'insurance', -2500, 'insurance')
    onDay(y, m0, SPECS.medical!.anchorDay, 'medical', -3500, 'medical')
    onDay(y, m0, SPECS.gym!.anchorDay, 'gym', -699, 'gym')
    onDay(y, m0, SPECS.internet!.anchorDay, 'internet', -1000, 'internet')
    onDay(y, m0, SPECS.netflix!.anchorDay, 'netflix', -199, 'netflix')
    onDay(y, m0, SPECS.spotify!.anchorDay, 'spotify', -80, 'spotify')

    // Variable monthly expenses (utilities creep up slightly with the trend)
    onDay(y, m0, SPECS.utilities!.anchorDay, 'utilities', jitter(-2000 - (5 - Math.min(monthsAgo, 5)) * 40, 0.16, `util-${k}`), 'utilities')
    onDay(y, m0, SPECS.water!.anchorDay, 'water', jitter(-600, 0.28, `water-${k}`), 'water')

    // Quarterly — provisional tax (Mar/Jun/Sep/Dec) and car service (Jan/Apr/Jul/Oct)
    if (m0 % 3 === 2) onDay(y, m0, SPECS.tax!.anchorDay, 'tax', -8500, 'tax')
    if (m0 % 3 === 0) onDay(y, m0, SPECS.service!.anchorDay, 'service', jitter(-2800, 0.3, `svc-${k}`), 'service')
  }

  // ── Biweekly freelance income (every 14 days, anchored to a Thursday) ──
  let fl = new Date(start)
  while (fl.getDay() !== SPECS.freelance!.anchorDay) fl = addDays(fl, 1)
  for (; fl <= today; fl = addDays(fl, 14)) {
    addRecurring('freelance', fl, jitter(3200, 0.32, `fl-${iso(fl)}`), 'freelance')
  }

  // ── Weekly groceries (Saturdays), rotating stores ──
  const grocStores = ['Checkers Groceries', 'Pick n Pay', 'Woolworths Food', 'Spar']
  let g = new Date(start)
  while (g.getDay() !== SPECS.groceries!.anchorDay) g = addDays(g, 1)
  for (let i = 0; g <= today; g = addDays(g, 7), i++) {
    addRecurring('groc', g, jitter(-1150, 0.22, `groc-${iso(g)}`), 'groceries', grocStores[i % grocStores.length])
  }

  // ── Weekly fuel (Wednesdays), rotating stations ──
  const stations = ['Engen fuel', 'Shell fuel', 'BP fuel', 'Sasol fuel']
  let fu = new Date(start)
  while (fu.getDay() !== SPECS.fuel!.anchorDay) fu = addDays(fu, 1)
  for (let i = 0; fu <= today; fu = addDays(fu, 7), i++) {
    addRecurring('fuel', fu, jitter(-900, 0.2, `fuel-${iso(fu)}`), 'fuel', stations[i % stations.length])
  }

  // ── Daily weekday coffee (drives day-of-week seasonality + dense daily series) ──
  for (let c = new Date(start); c <= today; c = addDays(c, 1)) {
    const dow = c.getDay()
    if (dow >= 1 && dow <= 5) addRecurring('coffee', c, jitter(-42, 0.18, `cof-${iso(c)}`), 'coffee')
  }

  // ── Irregular / on-demand spending (deterministic per-day probability) ──
  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const ds = iso(d)
    const dow = d.getDay()
    const weekend = dow === 5 || dow === 6

    // Dining out — weekend-weighted (once-off, variable amount)
    if (rand(`dine-${ds}`) < (weekend ? 0.5 : 0.06)) {
      const places = ['Nandos', 'Spur', 'Ocean Basket', 'Steers', 'Kauai', 'RocoMamas', 'The Bohemian']
      addOnce('dine', d, jitter(-380, 0.4, `dinea-${ds}`), places[Math.floor(rand(`dinep-${ds}`) * places.length)]!, ['Food', 'Discretionary'])
    }
    // Ride-hailing
    if (rand(`uber-${ds}`) < 0.13) addOnce('uber', d, jitter(-150, 0.5, `ubera-${ds}`), 'Uber trip', ['Transport'])
    // Online shopping
    if (rand(`shop-${ds}`) < 0.07) addOnce('shop', d, jitter(-520, 0.6, `shopa-${ds}`), 'Takealot order', ['Shopping'])
    // Irregular recurring — prepaid electricity (linked group → projected as daily rate)
    if (rand(`elec-${ds}`) < 0.06) addRecurring('elec', d, jitter(-350, 0.3, `eleca-${ds}`), 'prepaid-elec')
    // Irregular recurring — data bundles
    if (rand(`data-${ds}`) < 0.045) addRecurring('data', d, jitter(-180, 0.3, `dataa-${ds}`), 'data')
  }

  // ── Annual renewals (one occurrence each, placed in history) ──
  const licDate = new Date(today.getFullYear(), today.getMonth() - 6, SPECS.licence!.anchorDay)
  addRecurring('licence', licDate, -680, 'licence')
  const hostDate = new Date(today.getFullYear(), today.getMonth() - 9, SPECS.hosting!.anchorDay)
  addRecurring('hosting', hostDate, -1850, 'hosting')

  // ── Once-off shocks (test once-off handling + runway dips) ──
  addOnce('laptop', new Date(today.getFullYear(), today.getMonth() - 4, 18), -14000, 'Laptop — iStore', ['Shopping'])
  addOnce('flights', new Date(today.getFullYear(), today.getMonth() - 7, 9), -5000, 'Flight booking — FlySafair', ['Travel'])
  addOnce('dental', new Date(today.getFullYear(), today.getMonth() - 2, 14), -3200, 'Dentist — crown', ['Medical'])

  // ── Build patterns from the collected stats ──
  const patterns: RecurringPattern[] = []
  for (const [id, spec] of Object.entries(SPECS)) {
    const s = stats.get(id)
    if (!s || s.amounts.length === 0) continue // no occurrences fell in range
    patterns.push(
      makePattern(
        id,
        spec.description,
        Math.round(meanOf(s.amounts)),
        spec.frequency,
        spec.anchorDay,
        spec.tags,
        s.lastSeen,
        spec.variability,
        Math.round(stdOf(s.amounts)),
      ),
    )
  }

  return { transactions: txns, patterns }
}

/**
 * Seed the demo workspace if the DB is empty (first visit).
 * Returns true if the demo was created, false if skipped.
 */
export async function seedDemoWorkspace(): Promise<boolean> {
  const count = await db.workspaces.count()
  if (count > 0) return false

  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nowISO = now.toISOString()

  const workspace: Workspace = {
    id: DEMO_WORKSPACE_ID,
    name: 'Demo Workspace',
    currencyLabel: 'R',
    periodType: 'monthly',
    startDate,
    endDate: null,
    isDemo: true,
    cashOnHand: 20000,
    createdAt: nowISO,
    updatedAt: nowISO,
  }

  const { transactions, patterns } = buildDemoData(now)

  try {
    await db.transaction('rw', [db.workspaces, db.transactions, db.patterns], async () => {
      await db.workspaces.add(workspace)
      await db.transactions.bulkAdd(transactions)
      await db.patterns.bulkAdd(patterns)
    })
    // Seed tagCache so ML suggestions have candidate labels from the start
    const allTags = new Set<string>()
    for (const t of transactions) for (const tag of t.tags) allTags.add(tag)
    for (const p of patterns) for (const tag of p.tags) allTags.add(tag)
    await touchTags([...allTags])

    // Open the demo on a 12-month forecast so the full year of history + the
    // cash-runway depletion (a mild, realistic deficit) are visible by default;
    // the 3-month default would be too short to surface the runway date.
    safeSetItem(`farlume:forecast-months:${DEMO_WORKSPACE_ID}`, '12')

    debugLog('db', 'success', `Seeded demo workspace with ${transactions.length} transactions and ${patterns.length} patterns`)
    return true
  } catch (err) {
    debugLog('db', 'error', `Failed to seed demo workspace: ${err}`)
    return false
  }
}
