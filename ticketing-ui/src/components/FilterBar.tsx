import { useState, useEffect, useRef } from 'react';
import type { TagDto, VenueDetail } from '../types';
import { MultiTagSelect } from './MultiTagSelect';

const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'] as const;

export interface FilterValues {
  title: string;
  tagIds: number[];
  ratings: string[];
  venueIds: number[];
  minPrice: string;
  maxPrice: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_FILTERS: FilterValues = {
  title: '', tagIds: [], ratings: [], venueIds: [],
  minPrice: '', maxPrice: '', startDate: '', endDate: '',
};

interface Props {
  allTags: TagDto[];
  allVenues: VenueDetail[];
  initial: FilterValues;
  onApply: (filters: FilterValues) => void;
}

function countAdvanced(f: FilterValues) {
  return (f.tagIds.length > 0 ? 1 : 0)
    + (f.ratings.length > 0 ? 1 : 0)
    + (f.venueIds.length > 0 ? 1 : 0)
    + (f.minPrice || f.maxPrice ? 1 : 0)
    + (f.startDate || f.endDate ? 1 : 0);
}

function fmtDateChip(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function FilterBar({ allTags, allVenues, initial, onApply }: Props) {
  const [title, setTitle]         = useState(initial.title);
  const [tagIds, setTagIds]       = useState(initial.tagIds);
  const [ratings, setRatings]     = useState(initial.ratings);
  const [venueIds, setVenueIds]   = useState(initial.venueIds);
  const [minPrice, setMinPrice]   = useState(initial.minPrice);
  const [maxPrice, setMaxPrice]   = useState(initial.maxPrice);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate]     = useState(initial.endDate);
  const [open, setOpen]           = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(initial.title);
    setTagIds(initial.tagIds);
    setRatings(initial.ratings);
    setVenueIds(initial.venueIds);
    setMinPrice(initial.minPrice);
    setMaxPrice(initial.maxPrice);
    setStartDate(initial.startDate);
    setEndDate(initial.endDate);
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function current(): FilterValues {
    return { title, tagIds, ratings, venueIds, minPrice, maxPrice, startDate, endDate };
  }

  function handleApply() {
    setOpen(false);
    onApply(current());
  }

  function handleClear() {
    setTitle(''); setTagIds([]); setRatings([]); setVenueIds([]);
    setMinPrice(''); setMaxPrice(''); setStartDate(''); setEndDate('');
    setOpen(false);
    onApply(EMPTY_FILTERS);
  }

  function toggleRating(r: string) {
    setRatings(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  function toggleVenue(id: number) {
    setVenueIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const advancedCount = countAdvanced({ title: '', tagIds, ratings, venueIds, minPrice, maxPrice, startDate, endDate });
  const hasAnyFilter  = title.trim() !== '' || advancedCount > 0;

  return (
    <div className="mb-6">
      {/* ── Top row ── */}
      <div className="flex gap-2 items-center" ref={panelRef}>

        {/* Title search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
            placeholder="Search events by title…"
            className="w-full border border-gray-300 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
          {title && (
            <button
              onClick={() => { setTitle(''); onApply({ ...current(), title: '' }); }}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters toggle */}
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              open || advancedCount > 0
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6" />
            </svg>
            Filters
            {advancedCount > 0 && (
              <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                open ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
              }`}>
                {advancedCount}
              </span>
            )}
          </button>

          {/* ── Advanced panel ── */}
          {open && (
            <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                <p className="text-sm font-semibold text-gray-800">Filters</p>
                {advancedCount > 0 && (
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {advancedCount} active
                  </span>
                )}
              </div>

              <div className="p-5 space-y-5">
                {/* Age Rating */}
                <div>
                  <SectionLabel icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  }>Age Rating</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {RATINGS.map(r => (
                      <button
                        key={r}
                        onClick={() => toggleRating(r)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          ratings.includes(r)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Venue */}
                {allVenues.length > 0 && (
                  <div>
                    <SectionLabel icon={
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }>Venue</SectionLabel>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {allVenues.map(v => (
                        <label key={v.venueId} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={venueIds.includes(v.venueId)}
                            onChange={() => toggleVenue(v.venueId)}
                            className="accent-indigo-600 w-3.5 h-3.5 shrink-0"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-indigo-700 leading-tight">{v.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div>
                  <SectionLabel icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  }>Tags</SectionLabel>
                  <MultiTagSelect options={allTags} selected={tagIds} onChange={setTagIds} compact />
                </div>

                {/* Price */}
                <div>
                  <SectionLabel icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }>Price (฿)</SectionLabel>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" min={0} value={minPrice}
                      onChange={e => setMinPrice(e.target.value)}
                      placeholder="Min"
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-400 text-sm shrink-0">–</span>
                    <input
                      type="number" min={0} value={maxPrice}
                      onChange={e => setMaxPrice(e.target.value)}
                      placeholder="Max"
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <SectionLabel icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }>Date</SectionLabel>
                  <div className="flex gap-2 items-center">
                    <input
                      type="date" value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-400 text-sm shrink-0">–</span>
                    <input
                      type="date" value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Panel actions */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={handleApply}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Apply
                  </button>
                  {advancedCount > 0 && (
                    <button
                      onClick={handleClear}
                      className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search button */}
        <button
          onClick={handleApply}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Search
        </button>

        {/* Global clear (visible when any filter active) */}
        {hasAnyFilter && (
          <button
            onClick={handleClear}
            className="border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Active filter chips ── */}
      {hasAnyFilter && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {title.trim() && (
            <Chip label={`"${title.trim()}"`} onRemove={() => { setTitle(''); onApply({ ...current(), title: '' }); }} />
          )}
          {ratings.map(r => (
            <Chip key={r} label={r} onRemove={() => { const next = ratings.filter(x => x !== r); setRatings(next); onApply({ ...current(), ratings: next }); }} />
          ))}
          {venueIds.map(id => {
            const v = allVenues.find(x => x.venueId === id);
            return v ? (
              <Chip key={id} label={v.name} onRemove={() => { const next = venueIds.filter(x => x !== id); setVenueIds(next); onApply({ ...current(), venueIds: next }); }} />
            ) : null;
          })}
          {tagIds.map(id => {
            const t = allTags.find(x => x.typeId === id);
            return t ? (
              <Chip key={id} label={t.typeName} onRemove={() => { const next = tagIds.filter(x => x !== id); setTagIds(next); onApply({ ...current(), tagIds: next }); }} />
            ) : null;
          })}
          {(minPrice || maxPrice) && (
            <Chip
              label={minPrice && maxPrice ? `฿${minPrice}–฿${maxPrice}` : minPrice ? `Min ฿${minPrice}` : `Max ฿${maxPrice}`}
              onRemove={() => { setMinPrice(''); setMaxPrice(''); onApply({ ...current(), minPrice: '', maxPrice: '' }); }}
            />
          )}
          {(startDate || endDate) && (
            <Chip
              label={
                startDate && endDate ? `${fmtDateChip(startDate)} → ${fmtDateChip(endDate)}`
                : startDate ? `From ${fmtDateChip(startDate)}`
                : `Until ${fmtDateChip(endDate)}`
              }
              onRemove={() => { setStartDate(''); setEndDate(''); onApply({ ...current(), startDate: '', endDate: '' }); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-indigo-400">{icon}</span>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{children}</p>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-200">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-indigo-900 transition-colors ml-0.5"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
