import { useState, useEffect } from 'react';
import type { Showtime, VenueLayout, SeatInfo } from '../types';
import { api } from '../services/ApiService';

interface Props {
  showtime: Showtime;
  onConfirm: (tickets: { tierId: number; seatCode: string }[]) => void;
  onCancel: () => void;
}

const TIER_COLORS = [
  'bg-yellow-400 text-yellow-900',
  'bg-blue-400 text-blue-900',
  'bg-green-400 text-green-900',
  'bg-pink-400 text-pink-900',
  'bg-orange-400 text-orange-900',
];

const TIER_DOT_COLORS = [
  'bg-yellow-400',
  'bg-blue-400',
  'bg-green-400',
  'bg-pink-400',
  'bg-orange-400',
];

function SkeletonSeatMap() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 bg-gray-200 rounded-full w-28" />
        ))}
      </div>
      <div className="mb-2 flex flex-col items-center gap-1">
        <div className="h-3 bg-gray-100 rounded w-12" />
        <div className="h-1.5 bg-gray-200 rounded-full w-48" />
      </div>
      <div className="space-y-2 mt-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5 justify-center">
            <div className="w-6 h-8 bg-gray-100 rounded shrink-0" />
            {Array.from({ length: 10 }).map((_, j) => (
              <div key={j} className="w-8 h-8 bg-gray-200 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeatSelection({ showtime, onConfirm, onCancel }: Props) {
  const [layout, setLayout] = useState<VenueLayout | null>(null);
  const [selected, setSelected] = useState<SeatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getVenueLayout(showtime.venue.venueId, showtime.showtimeId)
      .then(setLayout)
      .catch(() => setError('Failed to load seat map'))
      .finally(() => setLoading(false));
  }, [showtime]);

  const maxSeats = showtime.ticketPerPerson;

  function toggle(seat: SeatInfo) {
    if (!seat.available) return;
    setSelected(prev => {
      const already = prev.find(s => s.seatCode === seat.seatCode);
      if (already) return prev.filter(s => s.seatCode !== seat.seatCode);
      if (prev.length >= maxSeats) return prev;
      return [...prev, seat];
    });
  }

  // Assign a stable color index per tier based on order in showtime.tiers
  const tierColorIndex: Record<number, number> = {};
  showtime.tiers.forEach((t, i) => { tierColorIndex[t.tierId] = i % TIER_COLORS.length; });

  function seatBgClass(seat: SeatInfo) {
    const isSelected = selected.some(s => s.seatCode === seat.seatCode);
    if (isSelected) return 'bg-indigo-600 text-white ring-2 ring-indigo-300';
    if (!seat.available) return 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60';
    const colorIdx = tierColorIndex[seat.tierId] ?? 0;
    return `${TIER_COLORS[colorIdx]} hover:opacity-75 cursor-pointer`;
  }

  const grouped = layout?.seats.reduce<Record<string, SeatInfo[]>>((acc, s) => {
    const row = s.seatCode.split('-')[0];
    if (!acc[row]) acc[row] = [];
    acc[row].push(s);
    return acc;
  }, {}) ?? {};

  const tierAvailableCount = layout?.seats.reduce<Record<number, number>>((acc, s) => {
    if (s.available) acc[s.tierId] = (acc[s.tierId] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  const total = selected.reduce((sum, s) => sum + s.price, 0);
  const atMax = selected.length >= maxSeats;

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{showtime.event.title}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-500">
              <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{showtime.venue.name}</span>
              <span className="text-gray-300">·</span>
              <span className="shrink-0">{new Date(showtime.showSchedules).toLocaleString('en-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
          {loading ? (
            <SkeletonSeatMap />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-600 font-medium mb-1">Failed to load seat map</p>
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : !layout ? null : (
            <>
              {/* Tier legend */}
              <div className="flex flex-wrap gap-2 mb-5">
                {showtime.tiers.map((t, i) => {
                  const avail = tierAvailableCount[t.tierId] ?? 0;
                  return (
                    <div key={t.tierId} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TIER_DOT_COLORS[i % TIER_DOT_COLORS.length]}`} />
                      <span className="font-medium text-gray-700">{t.tierName}</span>
                      <span className="text-gray-400">฿{t.price.toLocaleString()}</span>
                      {avail === 0
                        ? <span className="text-gray-400 italic">sold out</span>
                        : <span className="text-gray-500">({avail} left)</span>
                      }
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                  <span className="text-gray-700">Selected</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
                  <span className="text-gray-500">Unavailable</span>
                </div>
              </div>

              {/* Stage indicator */}
              <div className="mb-5 flex flex-col items-center gap-1.5">
                <div className="h-2 w-52 bg-gradient-to-r from-indigo-300 via-violet-400 to-indigo-300 rounded-full opacity-60" />
                <p className="text-xs text-gray-400 uppercase tracking-widest">Stage</p>
              </div>

              {/* Seat grid */}
              <div className="space-y-1.5 mb-5">
                {Object.entries(grouped).map(([row, seats]) => (
                  <div key={row} className="flex items-center gap-1.5 justify-center flex-wrap">
                    <span className="text-xs text-gray-400 w-6 text-right shrink-0">{row}</span>
                    {seats.map(seat => (
                      <button
                        key={seat.seatCode}
                        onClick={() => toggle(seat)}
                        disabled={!seat.available || (atMax && !selected.some(s => s.seatCode === seat.seatCode))}
                        className={`w-8 h-8 rounded text-xs font-semibold transition-all ${seatBgClass(seat)} ${
                          atMax && !selected.some(s => s.seatCode === seat.seatCode) && seat.available
                            ? 'opacity-40 cursor-not-allowed'
                            : ''
                        }`}
                        title={`${seat.seatCode} — ${seat.tierName} ฿${seat.price.toLocaleString()}`}
                      >
                        {seat.seatCode.split('-')[1] ?? ''}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Seat limit hint */}
              <p className="text-xs text-gray-400 text-center mb-4">
                {atMax
                  ? <span className="text-indigo-600 font-medium">Max {maxSeats} seat{maxSeats > 1 ? 's' : ''} selected</span>
                  : <>Select up to <span className="font-medium">{maxSeats}</span> seat{maxSeats > 1 ? 's' : ''} · <span className="font-medium">{selected.length}</span> selected</>
                }
              </p>

              {/* Selection summary */}
              {selected.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 text-sm">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Your Selection</p>
                  <div className="space-y-1">
                    {selected.map(s => (
                      <div key={s.seatCode} className="flex justify-between text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium">{s.seatCode}</span>
                          <span className="text-xs text-gray-400 bg-white px-1.5 py-0.5 rounded-full border border-indigo-100">{s.tierName}</span>
                        </span>
                        <span className="font-medium">฿{s.price.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-gray-900 border-t border-indigo-200 pt-2 mt-2">
                      <span>Total</span>
                      <span className="text-indigo-700">฿{total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0 bg-white rounded-b-2xl">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selected.length > 0 && onConfirm(selected.map(s => ({ tierId: s.tierId, seatCode: s.seatCode })))}
            disabled={selected.length === 0}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {selected.length === 0
              ? 'Select a seat'
              : `Book ${selected.length} Seat${selected.length !== 1 ? 's' : ''} — ฿${total.toLocaleString()}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
