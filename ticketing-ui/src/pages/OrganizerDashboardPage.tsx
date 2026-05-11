import { useState, useEffect, type FormEvent } from 'react';
import type { Showtime, TagDto } from '../types';
import { api } from '../services/ApiService';
import { useAuth } from '../context/AuthContext';
import { AddShowtimeModal } from '../components/AddShowtimeModal';
import { EditShowtimeModal } from '../components/EditShowtimeModal';
import { MultiTagSelect } from '../components/MultiTagSelect';

interface Props {
  onNavigate: (page: string) => void;
}

interface EventGroup {
  eventId: number;
  title: string;
  durationMinutes: number;
  rating: number;
  thumbnail: string;
  description: string;
  tags: { typeId: number; typeName: string }[];
  showtimes: Showtime[];
}

const TAG_COLORS: Record<string, string> = {
  Musical:    'bg-pink-100 text-pink-700',
  Concert:    'bg-blue-100 text-blue-700',
  Conference: 'bg-gray-100 text-gray-700',
  Sport:      'bg-green-100 text-green-700',
  Comedy:     'bg-yellow-100 text-yellow-700',
  Exhibition: 'bg-orange-100 text-orange-700',
};

function fmtDateTime(dt: string) {
  return new Date(dt).toLocaleString('en-TH', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function SkeletonEventCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-40" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-24 bg-gray-200 rounded-lg" />
          <div className="h-7 w-14 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="px-5 py-3 space-y-2.5">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    </div>
  );
}

function AvailabilityDot({ available, total }: { available: number; total: number }) {
  if (total === 0) return null;
  const pct = available / total;
  const color = available === 0 ? 'bg-gray-300' : pct <= 0.1 ? 'bg-red-400' : pct <= 0.3 ? 'bg-amber-400' : 'bg-green-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color} shrink-0`} />;
}

export function OrganizerDashboardPage({ onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<TagDto[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [form, setForm] = useState({ title: '', durationMinutes: '', rating: '', thumbnail: '', description: '' });
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [editingEvent, setEditingEvent] = useState<EventGroup | null>(null);
  const [editForm, setEditForm] = useState({ title: '', durationMinutes: '', rating: '', thumbnail: '', description: '' });
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  const [addShowtimeFor, setAddShowtimeFor] = useState<EventGroup | null>(null);
  const [editingShowtime, setEditingShowtime] = useState<Showtime | null>(null);

  function reload() {
    setLoading(true);
    const fetch = user?.role === 'admin' ? api.getEvents() : api.getMyEvents();
    fetch.then(setEventGroups).finally(() => setLoading(false));
  }

  useEffect(() => {
    api.getTags().then(setAllTags);
    reload();
  }, []);

  async function handleDeleteEvent(group: EventGroup) {
    if (!confirm(`Delete "${group.title}" and all its showtimes? This cannot be undone.`)) return;
    setError('');
    try {
      await api.deleteEvent(group.eventId);
      setEventGroups(prev => prev.filter(g => g.eventId !== group.eventId));
      setSuccess(`"${group.title}" deleted.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleDeleteShowtime(showtimeId: number, eventId: number, label: string) {
    if (!confirm(`Delete showtime "${label}"? This cannot be undone.`)) return;
    setError('');
    try {
      await api.deleteShowtime(showtimeId);
      setEventGroups(prev =>
        prev.map(g =>
          g.eventId === eventId
            ? { ...g, showtimes: g.showtimes.filter(s => s.showtimeId !== showtimeId) }
            : g,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function openEditEvent(group: EventGroup) {
    setEditingEvent(group);
    setEditForm({
      title: group.title,
      durationMinutes: String(group.durationMinutes),
      rating: String(group.rating),
      thumbnail: group.thumbnail ?? '',
      description: group.description ?? '',
    });
    setEditTagIds(group.tags.map(t => t.typeId));
    setEditFormError('');
    setSuccess('');
    setError('');
  }

  async function handleEditEvent(e: FormEvent) {
    e.preventDefault();
    if (!editingEvent) return;
    if (editTagIds.length === 0) { setEditFormError('Please select at least one tag.'); return; }
    setEditFormError('');
    setEditSubmitting(true);
    try {
      await api.updateEvent(editingEvent.eventId, {
        title: editForm.title,
        durationMinutes: Number(editForm.durationMinutes),
        rating: editForm.rating,
        thumbnail: editForm.thumbnail,
        description: editForm.description,
        tagIds: editTagIds,
      });
      setSuccess(`"${editForm.title}" updated!`);
      setEditingEvent(null);
      reload();
    } catch (err: unknown) {
      setEditFormError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setEditSubmitting(false);
    }
  }

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function setEditField(field: string, value: string) {
    setEditForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (selectedTagIds.length === 0) {
        setFormError('Please select at least one tag.');
        setSubmitting(false);
        return;
      }
      await api.createEvent({
        title: form.title,
        durationMinutes: Number(form.durationMinutes),
        rating: form.rating,
        thumbnail: form.thumbnail,
        description: form.description,
        tagIds: selectedTagIds,
      });
      setSuccess(`Event "${form.title}" created!`);
      setShowCreateEvent(false);
      setForm({ title: '', durationMinutes: '', rating: '', thumbnail: '', description: '' });
      setSelectedTagIds([]);
      reload();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-violet-700 shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">🎫 NoLife Ticket</h1>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              isAdmin ? 'bg-red-400/30 text-red-100 border border-red-300/40'
                      : 'bg-white/20 text-white border border-white/30'
            }`}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-indigo-100">Hi, {user?.firstName}</span>
            {isAdmin && (
              <>
                <button onClick={() => onNavigate('admin-overview')} className="text-sm text-indigo-100 hover:text-white transition-colors">Overview</button>
                <span className="text-sm text-white font-medium bg-white/20 px-3 py-1.5 rounded-lg">Events</span>
                <button onClick={() => onNavigate('admin-venues')} className="text-sm text-indigo-100 hover:text-white transition-colors">Venues</button>
                <button onClick={() => onNavigate('admin-reports')} className="text-sm text-indigo-100 hover:text-white transition-colors">Reports</button>
                <button onClick={() => onNavigate('admin-users')} className="text-sm text-indigo-100 hover:text-white transition-colors">Users</button>
              </>
            )}
            <button onClick={() => onNavigate('events')} className="text-sm text-indigo-100 hover:text-white transition-colors">Browse</button>
            <button onClick={logout} className="text-sm text-indigo-300 hover:text-white transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isAdmin ? 'Admin Dashboard' : 'My Events'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isAdmin ? 'Manage all events and showtimes' : 'Manage your events and showtimes'}
            </p>
          </div>
          <button
            onClick={() => { setShowCreateEvent(true); setSuccess(''); setFormError(''); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Create Event
          </button>
        </div>

        {/* Banners */}
        {success && (
          <div className="mb-5 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Event list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonEventCard key={i} />)}
          </div>
        ) : eventGroups.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
            <div className="text-5xl mb-4">🎭</div>
            <p className="text-gray-700 font-medium text-lg mb-1">No events yet</p>
            <p className="text-sm text-gray-400 mb-5">Create your first event and add showtimes to get started.</p>
            <button
              onClick={() => setShowCreateEvent(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Create your first event
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {eventGroups.map(group => {
              const totalSeats = group.showtimes.reduce((sum, s) => sum + s.tiers.reduce((ts, t) => ts + t.totalAmount, 0), 0);
              const availSeats = group.showtimes.reduce((sum, s) => sum + s.tiers.reduce((ts, t) => ts + t.available, 0), 0);

              return (
                <div key={group.eventId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Event header */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnail or placeholder */}
                      {group.thumbnail ? (
                        <img src={group.thumbnail} alt={group.title} className="w-11 h-11 rounded-lg object-cover shrink-0 border border-gray-100" onError={e => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 text-lg">🎫</div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">{group.title}</span>
                          {group.rating && (
                            <span className="text-xs border border-gray-300 text-gray-500 font-bold px-1.5 py-0.5 rounded shrink-0">{group.rating}</span>
                          )}
                          <span className="text-xs text-gray-400 shrink-0">{group.durationMinutes} min</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {group.tags.map(tag => (
                            <span key={tag.typeId} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[tag.typeName] ?? 'bg-indigo-100 text-indigo-700'}`}>
                              {tag.typeName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Showtime count badge */}
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                        {group.showtimes.length} showtime{group.showtimes.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => { setAddShowtimeFor(group); setSuccess(''); setError(''); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 font-medium transition-colors"
                      >
                        + Showtime
                      </button>
                      <button
                        onClick={() => openEditEvent(group)}
                        className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                      >
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteEvent(group)}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Showtimes */}
                  {group.showtimes.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      No showtimes yet —
                      <button onClick={() => { setAddShowtimeFor(group); setSuccess(''); setError(''); }} className="text-indigo-500 hover:text-indigo-700 font-medium">
                        add one
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {/* Aggregate seats row */}
                      {group.showtimes.length > 1 && (
                        <div className="px-5 py-2 bg-gray-50/60 flex items-center gap-2 text-xs text-gray-500">
                          <AvailabilityDot available={availSeats} total={totalSeats} />
                          <span>{availSeats.toLocaleString()} / {totalSeats.toLocaleString()} seats available across all showtimes</span>
                        </div>
                      )}
                      {group.showtimes.map(s => {
                        const sAvail = s.tiers.reduce((sum, t) => sum + t.available, 0);
                        const sTotal = s.tiers.reduce((sum, t) => sum + t.totalAmount, 0);
                        const minPrice = Math.min(...s.tiers.map(t => t.price));

                        return (
                          <div key={s.showtimeId} className="px-5 py-3.5 flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 mb-1">
                                <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {fmtDateTime(s.showSchedules)}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                                <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {s.venue.name}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {s.tiers.map(t => (
                                  <span key={t.tierId} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                    {t.tierName} ฿{t.price.toLocaleString()}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <AvailabilityDot available={sAvail} total={sTotal} />
                                  <span className={`text-sm font-medium ${sAvail === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                                    {sAvail === 0 ? 'Sold out' : `${sAvail.toLocaleString()} left`}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">from ฿{minPrice.toLocaleString()}</p>
                              </div>
                              <button
                                onClick={() => { setEditingShowtime(s); setSuccess(''); setError(''); }}
                                className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteShowtime(s.showtimeId, group.eventId, `${s.venue.name} · ${fmtDateTime(s.showSchedules)}`)}
                                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Create Event Modal ── */}
      {showCreateEvent && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Create New Event</h3>
              <button onClick={() => setShowCreateEvent(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              {formError && (
                <p className="text-sm text-red-600 mb-4 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{formError}</p>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <Field label="Title">
                  <input type="text" required value={form.title} onChange={e => setField('title', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" required min={1} value={form.durationMinutes} onChange={e => setField('durationMinutes', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Tags" hint="select one or more">
                  <MultiTagSelect options={allTags} selected={selectedTagIds} onChange={setSelectedTagIds} />
                </Field>
                <Field label="Age Rating">
                  <select value={form.rating} onChange={e => setField('rating', e.target.value)} className={inputCls}>
                    <RatingOptions />
                  </select>
                </Field>
                <Field label="Thumbnail URL">
                  <input type="url" value={form.thumbnail} onChange={e => setField('thumbnail', e.target.value)} placeholder="https://…" className={inputCls} />
                </Field>
                <Field label="Description" hint="optional">
                  <textarea rows={4} maxLength={3000} value={form.description} onChange={e => setField('description', e.target.value)}
                    placeholder="Describe your event…" className={`${inputCls} resize-y`} />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{form.description.length}/3000</p>
                </Field>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowCreateEvent(false)} className={cancelBtn}>Cancel</button>
                  <button type="submit" disabled={submitting} className={submitBtn}>
                    {submitting ? 'Creating…' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Event Modal ── */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Event</h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{editingEvent.title}</p>
              </div>
              <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              {editFormError && (
                <p className="text-sm text-red-600 mb-4 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{editFormError}</p>
              )}
              <form onSubmit={handleEditEvent} className="space-y-4">
                <Field label="Title">
                  <input type="text" required value={editForm.title} onChange={e => setEditField('title', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" required min={1} value={editForm.durationMinutes} onChange={e => setEditField('durationMinutes', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Tags" hint="select one or more">
                  <MultiTagSelect options={allTags} selected={editTagIds} onChange={setEditTagIds} />
                </Field>
                <Field label="Age Rating">
                  <select value={editForm.rating} onChange={e => setEditField('rating', e.target.value)} className={inputCls}>
                    <RatingOptions />
                  </select>
                </Field>
                <Field label="Thumbnail URL">
                  <input type="url" value={editForm.thumbnail} onChange={e => setEditField('thumbnail', e.target.value)} placeholder="https://…" className={inputCls} />
                </Field>
                <Field label="Description" hint="optional">
                  <textarea rows={4} maxLength={3000} value={editForm.description} onChange={e => setEditField('description', e.target.value)}
                    placeholder="Describe your event…" className={`${inputCls} resize-y`} />
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{editForm.description.length}/3000</p>
                </Field>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setEditingEvent(null)} className={cancelBtn}>Cancel</button>
                  <button type="submit" disabled={editSubmitting} className={submitBtn}>
                    {editSubmitting ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {addShowtimeFor && (
        <AddShowtimeModal
          eventId={addShowtimeFor.eventId}
          eventTitle={addShowtimeFor.title}
          onClose={() => setAddShowtimeFor(null)}
          onSaved={() => { setAddShowtimeFor(null); setSuccess('Showtime created!'); reload(); }}
        />
      )}

      {editingShowtime && (
        <EditShowtimeModal
          showtime={editingShowtime}
          onClose={() => setEditingShowtime(null)}
          onSaved={() => { setEditingShowtime(null); setSuccess('Showtime updated!'); reload(); }}
        />
      )}
    </div>
  );
}

// ── Shared form helpers ──────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const cancelBtn = 'flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors';
const submitBtn = 'flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="text-gray-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function RatingOptions() {
  return (
    <>
      <option value="">Select rating…</option>
      <option value="G">G — General Audiences</option>
      <option value="PG">PG — Parental Guidance Suggested</option>
      <option value="PG-13">PG-13 — Parents Strongly Cautioned</option>
      <option value="R">R — Restricted</option>
      <option value="NC-17">NC-17 — Adults Only</option>
    </>
  );
}
