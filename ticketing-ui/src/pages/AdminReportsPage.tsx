import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { api } from '../services/ApiService';
import { useAuth } from '../context/AuthContext';

interface Props { onNavigate: (page: string) => void; }

// ── Peak Sales ────────────────────────────────────────────────────────────────
interface PeakSalesPoint {
  hour: number; label: string;
  sun: number; mon: number; tue: number; wed: number; thu: number; fri: number; sat: number;
}
const DAYS = [
  { key: 'mon', label: 'Mon', color: '#3b82f6' },
  { key: 'tue', label: 'Tue', color: '#10b981' },
  { key: 'wed', label: 'Wed', color: '#8b5cf6' },
  { key: 'thu', label: 'Thu', color: '#f59e0b' },
  { key: 'fri', label: 'Fri', color: '#ef4444' },
  { key: 'sat', label: 'Sat', color: '#ec4899' },
  { key: 'sun', label: 'Sun', color: '#f97316' },
] as const;
type DayKey = typeof DAYS[number]['key'];
function rowTotal(r: PeakSalesPoint) { return r.sun + r.mon + r.tue + r.wed + r.thu + r.fri + r.sat; }

// ── Other report types ────────────────────────────────────────────────────────
interface TagVenuePoint { tag: string; venueName: string; showtimeCount: number; ticketsSold: number; }
interface CapacityPoint { eventTitle: string; venueName: string; showSchedules: string; totalCapacity: number; bookedTickets: number; fillRate: number; }
interface TopEventPoint { eventTitle: string; ticketsSold: number; totalIncome: number; }
interface EventOption   { eventId: number; title: string; }

const REPORT_TYPES = [
  { value: 'peak-sales',  label: 'Peak Sales',    icon: '📈', desc: 'When tickets are purchased by hour & day' },
  { value: 'tag-venue',   label: 'Tag to Venue',  icon: '🏷️', desc: 'Which event types frequent which venues' },
  { value: 'capacity',    label: 'Capacity',       icon: '🎯', desc: 'Booking fill rate per showtime' },
  { value: 'top-income',  label: 'Top by Revenue', icon: '💰', desc: 'Highest-earning events' },
  { value: 'top-tickets', label: 'Top by Tickets', icon: '🎫', desc: 'Events with most tickets sold' },
];

const BAR_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6','#f97316'];
const inputCls   = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

// ── Shared sub-components ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <p className={`text-2xl font-bold truncate ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      {badge && (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
          {badge}
        </span>
      )}
    </div>
  );
}

function RankBadge({ i }: { i: number }) {
  if (i === 0) return <span className="text-base">🥇</span>;
  if (i === 1) return <span className="text-base">🥈</span>;
  if (i === 2) return <span className="text-base">🥉</span>;
  return <span className="text-xs font-bold text-gray-300">#{i + 1}</span>;
}

function SkeletonReport() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl px-5 py-4 h-24" />
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="h-4 bg-gray-200 rounded w-48 mb-6" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-4">
            <div className="h-3.5 bg-gray-200 rounded flex-1" />
            <div className="h-3.5 bg-gray-100 rounded w-20" />
            <div className="h-3.5 bg-gray-100 rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AdminReportsPage({ onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [reportType, setReportType] = useState('peak-sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [eventId, setEventId]     = useState<number | undefined>(undefined);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const [peakData,     setPeakData]     = useState<PeakSalesPoint[]>([]);
  const [tagVenueData, setTagVenueData] = useState<TagVenuePoint[]>([]);
  const [capacityData, setCapacityData] = useState<CapacityPoint[]>([]);
  const [incomeData,   setIncomeData]   = useState<TopEventPoint[]>([]);
  const [ticketsData,  setTicketsData]  = useState<TopEventPoint[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);

  useEffect(() => {
    api.getEvents()
      .then(evs => setEventOptions(evs.map(e => ({ eventId: e.eventId, title: e.title }))))
      .catch(() => setError('Failed to load event list'));
    load('peak-sales', '', '', undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(type: string, start: string, end: string, evId?: number) {
    setLoading(true);
    setError('');
    const f = { startDate: start || undefined, endDate: end || undefined };
    try {
      if (type === 'peak-sales')  setPeakData(await api.getPeakSales({ ...f, eventId: evId }));
      if (type === 'tag-venue')   setTagVenueData(await api.getTagVenue(f));
      if (type === 'capacity')    setCapacityData(await api.getCapacity(f));
      if (type === 'top-income')  setIncomeData(await api.getTopEventsByIncome(f));
      if (type === 'top-tickets') setTicketsData(await api.getTopEventsByTickets(f));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  function handleTypeChange(type: string) {
    setReportType(type);
    setEventId(undefined);
    load(type, startDate, endDate, undefined);
  }

  function handleApply() { load(reportType, startDate, endDate, eventId); }

  function handleClear() {
    setStartDate(''); setEndDate(''); setEventId(undefined);
    load(reportType, '', '', undefined);
  }

  const grandTotal = peakData.reduce((s, r) => s + rowTotal(r), 0);
  const colTotal   = (key: DayKey) => peakData.reduce((s, r) => s + r[key], 0);

  const isEmpty = ({
    'peak-sales':  peakData.length === 0,
    'tag-venue':   tagVenueData.length === 0,
    'capacity':    capacityData.length === 0,
    'top-income':  incomeData.length === 0,
    'top-tickets': ticketsData.length === 0,
  })[reportType] ?? true;

  const hasFilters    = !!(startDate || endDate || eventId);
  const currentMeta   = REPORT_TYPES.find(r => r.value === reportType)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-violet-700 shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">🎫 NoLife Ticket</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-400/30 text-red-100 border border-red-300/40">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-indigo-100">Hi, {user?.firstName}</span>
            <button onClick={() => onNavigate('admin-overview')} className="text-sm text-indigo-100 hover:text-white transition-colors">Overview</button>
            <button onClick={() => onNavigate('dashboard')} className="text-sm text-indigo-100 hover:text-white transition-colors">Events</button>
            <button onClick={() => onNavigate('admin-venues')} className="text-sm text-indigo-100 hover:text-white transition-colors">Venues</button>
            <button onClick={() => onNavigate('admin-reports')} className="text-sm text-white font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
              Reports
            </button>
            <button onClick={() => onNavigate('admin-users')} className="text-sm text-indigo-100 hover:text-white transition-colors">Users</button>
            <button onClick={() => onNavigate('events')} className="text-sm text-indigo-100 hover:text-white transition-colors">Browse</button>
            <button onClick={logout} className="text-sm text-indigo-300 hover:text-white transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">Analyse sales, capacity, and revenue data</p>
        </div>

        {/* Report type pill tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {REPORT_TYPES.map(r => (
            <button
              key={r.value}
              onClick={() => handleTypeChange(r.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                reportType === r.value
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <span>{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 mb-6 flex flex-wrap items-center gap-3 shadow-sm">
          <span className="text-xs font-medium text-gray-400 mr-1 uppercase tracking-wide">Filter</span>

          {reportType === 'peak-sales' && (
            <select
              value={eventId ?? ''}
              onChange={e => setEventId(e.target.value ? Number(e.target.value) : undefined)}
              className={inputCls}
            >
              <option value="">All Events</option>
              {eventOptions.map(e => (
                <option key={e.eventId} value={e.eventId}>{e.title}</option>
              ))}
            </select>
          )}

          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          <span className="text-gray-300">→</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />

          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {loading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Apply
          </button>
          {hasFilters && (
            <button onClick={handleClear} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 hidden sm:block">{currentMeta.desc}</span>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <SkeletonReport />
        ) : isEmpty ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-700 font-medium text-lg mb-1">No data found</p>
            <p className="text-sm text-gray-400">Try adjusting the date range or clearing the filters.</p>
          </div>
        ) : (
          <>
            {/* ── Peak Sales ─────────────────────────────────────── */}
            {reportType === 'peak-sales' && (() => {
              const peakHour = peakData.reduce((b, r) => rowTotal(r) > rowTotal(b) ? r : b, peakData[0]);
              const peakDay  = DAYS.reduce((b, d) => colTotal(d.key) > colTotal(b.key) ? d : b, DAYS[0]);
              return (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <StatCard label="Total Tickets" value={grandTotal.toLocaleString()} sub="across all hours & days" accent="text-indigo-700" />
                    <StatCard label="Peak Hour" value={peakHour.label} sub={`${rowTotal(peakHour).toLocaleString()} tickets`} />
                    <StatCard label="Busiest Day" value={peakDay.label} sub={`${colTotal(peakDay.key).toLocaleString()} tickets`} />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4 shadow-sm">
                    <SectionHeader title="Ticket Sales by Hour & Day of Week" badge={`${grandTotal.toLocaleString()} total`} />
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={peakData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip /><Legend />
                        {DAYS.map(d => (
                          <Line key={d.key} type="monotone" dataKey={d.key} name={d.label}
                            stroke={d.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">Sales Volume by Hour</h3>
                      <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                        {grandTotal.toLocaleString()} tickets total
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Hour</th>
                            {DAYS.map(d => <th key={d.key} className="text-center px-3 py-3 font-semibold" style={{ color: d.color }}>{d.label}</th>)}
                            <th className="text-center px-4 py-3 font-semibold text-gray-800">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {peakData.map(row => (
                            <tr key={row.hour} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-gray-700">{row.label}</td>
                              {DAYS.map(d => (
                                <td key={d.key} className="text-center px-3 py-2.5">
                                  {row[d.key] > 0
                                    ? <span className="font-medium" style={{ color: d.color }}>{row[d.key]}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                              ))}
                              <td className="text-center px-4 py-2.5 font-semibold text-gray-900">{rowTotal(row)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 border-t-2 border-gray-200">
                            <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
                            {DAYS.map(d => <td key={d.key} className="text-center px-3 py-3 font-semibold text-gray-700">{colTotal(d.key)}</td>)}
                            <td className="text-center px-4 py-3 font-bold text-gray-900">{grandTotal}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── Tag to Venue ───────────────────────────────────── */}
            {reportType === 'tag-venue' && (() => {
              const uniqueTags   = new Set(tagVenueData.map(r => r.tag)).size;
              const uniqueVenues = new Set(tagVenueData.map(r => r.venueName)).size;
              const topTag       = [...tagVenueData].sort((a, b) => b.showtimeCount - a.showtimeCount)[0];
              const tagTotals    = Object.values(
                tagVenueData.reduce((acc, r) => {
                  if (!acc[r.tag]) acc[r.tag] = { tag: r.tag, showtimeCount: 0 };
                  acc[r.tag].showtimeCount += r.showtimeCount;
                  return acc;
                }, {} as Record<string, { tag: string; showtimeCount: number }>)
              );
              return (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <StatCard label="Unique Tags" value={String(uniqueTags)} sub="event categories tracked" accent="text-indigo-700" />
                    <StatCard label="Unique Venues" value={String(uniqueVenues)} sub="venues used" />
                    <StatCard label="Most Active Tag" value={topTag?.tag ?? '—'} sub={topTag ? `${topTag.showtimeCount} shows at ${topTag.venueName}` : undefined} />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4 shadow-sm">
                    <SectionHeader title="Total Showtimes per Tag" />
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={tagTotals} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="tag" tick={{ fontSize: 12 }} width={120} />
                        <Tooltip formatter={(v: number) => [v, 'Showtimes']} />
                        <Bar dataKey="showtimeCount" name="Showtimes" radius={[0, 4, 4, 0]}>
                          {tagTotals.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-800">Tag × Venue Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Tag</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Venue</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Showtimes</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600">Tickets Sold</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {tagVenueData.map((r, i) => (
                            <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {r.tag}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{r.venueName}</td>
                              <td className="text-center px-4 py-3 font-bold text-indigo-700">{r.showtimeCount}</td>
                              <td className="text-right px-4 py-3 text-gray-700">{r.ticketsSold.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── Capacity Analysis ──────────────────────────────── */}
            {reportType === 'capacity' && (() => {
              const avgFill = capacityData.reduce((s, r) => s + (r.fillRate ?? 0), 0) / capacityData.length;
              const soldOut = capacityData.filter(r => (r.fillRate ?? 0) >= 90).length;
              const topShow = [...capacityData].sort((a, b) => (b.fillRate ?? 0) - (a.fillRate ?? 0))[0];
              return (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <StatCard label="Avg Fill Rate" value={`${avgFill.toFixed(1)}%`} sub="across all shows" accent="text-indigo-700" />
                    <StatCard label="Near Sold Out (≥90%)" value={String(soldOut)} sub={`of ${capacityData.length} shows`} />
                    <StatCard label="Fullest Show" value={topShow ? `${(topShow.fillRate ?? 0).toFixed(1)}%` : '—'} sub={topShow?.eventTitle} />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-800">Booking-to-Capacity per Showtime</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Event</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Venue</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600">Booked / Cap.</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 min-w-[160px]">Fill Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {capacityData.map((r, i) => {
                            const pct   = Math.min(100, r.fillRate ?? 0);
                            const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#6366f1';
                            return (
                              <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-900">{r.eventTitle}</td>
                                <td className="px-4 py-3 text-gray-600">{r.venueName}</td>
                                <td className="px-4 py-3 text-gray-600">
                                  {new Date(r.showSchedules).toLocaleString('en-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                                </td>
                                <td className="text-center px-4 py-3 text-gray-700">
                                  {r.bookedTickets.toLocaleString()} / {r.totalCapacity.toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                                      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                                    </div>
                                    <span className="text-xs font-semibold w-12 text-right" style={{ color }}>{pct.toFixed(1)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── Top Events by Income ───────────────────────────── */}
            {reportType === 'top-income' && (() => {
              const totalRevenue = incomeData.reduce((s, r) => s + Number(r.totalIncome), 0);
              return (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <StatCard label="Total Revenue" value={`฿${totalRevenue.toLocaleString()}`} sub="from confirmed bookings" accent="text-indigo-700" />
                    <StatCard label="#1 Event" value={incomeData[0]?.eventTitle ?? '—'} sub={incomeData[0] ? `฿${Number(incomeData[0].totalIncome).toLocaleString()}` : undefined} />
                    <StatCard label="Events Ranked" value={String(incomeData.length)} sub="in this period" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4 shadow-sm">
                    <SectionHeader title="Top Events by Revenue" badge={`฿${totalRevenue.toLocaleString()} total`} />
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={incomeData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `฿${Number(v).toLocaleString()}`} />
                        <YAxis type="category" dataKey="eventTitle" tick={{ fontSize: 12 }} width={120} />
                        <Tooltip formatter={(v: number) => [`฿${Number(v).toLocaleString()}`, 'Revenue']} />
                        <Bar dataKey="totalIncome" name="Revenue (฿)" radius={[0, 4, 4, 0]}>
                          {incomeData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">Rank</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Event</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600">Tickets Sold</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {incomeData.map((r, i) => (
                          <tr key={r.eventTitle} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-4 py-3 text-center"><RankBadge i={i} /></td>
                            <td className="px-4 py-3 font-medium text-gray-900">{r.eventTitle}</td>
                            <td className="text-center px-4 py-3 text-gray-700">{r.ticketsSold.toLocaleString()}</td>
                            <td className="text-right px-4 py-3 font-bold text-indigo-700">฿{Number(r.totalIncome).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            {/* ── Top Events by Tickets Sold ─────────────────────── */}
            {reportType === 'top-tickets' && (() => {
              const totalTickets = ticketsData.reduce((s, r) => s + r.ticketsSold, 0);
              return (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <StatCard label="Total Tickets Sold" value={totalTickets.toLocaleString()} sub="from confirmed bookings" accent="text-indigo-700" />
                    <StatCard label="#1 Event" value={ticketsData[0]?.eventTitle ?? '—'} sub={ticketsData[0] ? `${ticketsData[0].ticketsSold.toLocaleString()} tickets` : undefined} />
                    <StatCard label="Events Ranked" value={String(ticketsData.length)} sub="in this period" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4 shadow-sm">
                    <SectionHeader title="Top Events by Tickets Sold" badge={`${totalTickets.toLocaleString()} total`} />
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={ticketsData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="eventTitle" tick={{ fontSize: 12 }} width={120} />
                        <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Tickets']} />
                        <Bar dataKey="ticketsSold" name="Tickets Sold" radius={[0, 4, 4, 0]}>
                          {ticketsData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">Rank</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Event</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600">Tickets Sold</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ticketsData.map((r, i) => (
                          <tr key={r.eventTitle} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-4 py-3 text-center"><RankBadge i={i} /></td>
                            <td className="px-4 py-3 font-medium text-gray-900">{r.eventTitle}</td>
                            <td className="text-center px-4 py-3 font-bold text-indigo-700">{r.ticketsSold.toLocaleString()}</td>
                            <td className="text-right px-4 py-3 text-gray-700">฿{Number(r.totalIncome).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
