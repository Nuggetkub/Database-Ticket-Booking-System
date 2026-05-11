import { useEffect, useState } from 'react';
import type { BookingHistoryItem } from '../types';
import { api } from '../services/ApiService';
import { useAuth } from '../context/AuthContext';
import { usePaymentCountdown } from '../hooks/usePaymentCountdown';

interface Props {
  onNavigate: (page: string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  PENDING:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  EXPIRED:   'bg-gray-100 text-gray-500 border-gray-200',
};

function SkeletonBookingCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2 flex-1 min-w-0 pr-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-2/5" />
        </div>
        <div className="h-6 bg-gray-200 rounded-full w-20 shrink-0" />
      </div>
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/4 ml-auto mt-2" />
      </div>
    </div>
  );
}

function BookingCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const { minutes, seconds, expired } = usePaymentCountdown(expiresAt);

  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

  if (expired) return null;

  const urgent = minutes === 0;
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold mt-1.5 ${urgent ? 'text-red-600' : 'text-orange-500'}`}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Pay within {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}

export function BookingHistoryPage({ onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<BookingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const [payingBooking, setPayingBooking] = useState<BookingHistoryItem | null>(null);
  const [payMethod, setPayMethod] = useState('CREDIT_CARD');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    api.getBookingHistory()
      .then(setItems)
      .catch(() => setError('Failed to load booking history'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(bookingId: number, eventTitle: string) {
    if (!confirm(`Cancel your booking for "${eventTitle}"? This cannot be undone.`)) return;
    setCancellingId(bookingId);
    try {
      await api.cancelBooking(bookingId);
      setItems(prev => prev.map(item =>
        item.bookingId === bookingId ? { ...item, status: 'CANCELLED' } : item,
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setCancellingId(null);
    }
  }

  async function handlePay() {
    if (!payingBooking) return;
    setPaying(true);
    setPayError('');
    try {
      await api.processPayment(payingBooking.bookingId, payMethod, payingBooking.totalAmount);
      setItems(prev => prev.map(item =>
        item.bookingId === payingBooking.bookingId ? { ...item, status: 'CONFIRMED' } : item,
      ));
      setPayingBooking(null);
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  function markExpired(bookingId: number) {
    setItems(prev => prev.map(item =>
      item.bookingId === bookingId && item.status === 'PENDING'
        ? { ...item, status: 'EXPIRED' }
        : item,
    ));
    if (payingBooking?.bookingId === bookingId) setPayingBooking(null);
  }

  const pendingCount = items.filter(i => i.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-violet-700 shadow-md">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">🎫 NoLife Ticket</h1>
            <p className="text-indigo-200 text-xs mt-0.5">My Bookings</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-indigo-100">Hi, {user?.firstName}</span>
            <button
              onClick={() => onNavigate('events')}
              className="text-sm text-indigo-100 hover:text-white transition-colors"
            >
              Browse Events
            </button>
            <button onClick={logout} className="text-sm text-indigo-300 hover:text-white transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Bookings</h2>
            {!loading && items.length > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {items.length} booking{items.length !== 1 ? 's' : ''}
                {pendingCount > 0 && (
                  <span className="ml-2 text-yellow-600 font-medium">· {pendingCount} awaiting payment</span>
                )}
              </p>
            )}
          </div>
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
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonBookingCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-200">
            <div className="text-5xl mb-4">🎟️</div>
            <p className="text-gray-700 font-medium text-lg mb-1">No bookings yet</p>
            <p className="text-sm text-gray-400 mb-5">Find an event and book your first ticket.</p>
            <button
              onClick={() => onNavigate('events')}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Browse Events
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div
                key={item.bookingId}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Card header */}
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{item.eventTitle}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{item.venueName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-500">
                      <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(item.showSchedules).toLocaleString('en-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    {item.status === 'PENDING' && item.expiresAt && (
                      <BookingCountdown
                        expiresAt={item.expiresAt}
                        onExpired={() => markExpired(item.bookingId)}
                      />
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_STYLE[item.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {item.status}
                    </span>
                    {item.status === 'PENDING' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setPayingBooking(item); setPayError(''); }}
                          className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Pay now
                        </button>
                        <button
                          onClick={() => handleCancel(item.bookingId, item.eventTitle)}
                          disabled={cancellingId === item.bookingId}
                          className="text-xs text-red-600 hover:text-red-800 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 font-medium disabled:opacity-50 transition-colors"
                        >
                          {cancellingId === item.bookingId ? 'Cancelling…' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tickets */}
                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  {item.tickets.map(t => (
                    <div key={t.ticketId} className="flex justify-between text-sm text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <span className="text-gray-400">🎫</span>
                        {t.seatCode}
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{t.tierName}</span>
                      </span>
                      <span className="font-medium text-gray-700">฿{Number(t.price).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 mt-1">
                    <span>Total</span>
                    <span className="text-indigo-700">฿{Number(item.totalAmount).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Payment modal */}
      {payingBooking && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Complete Payment</h2>
                <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{payingBooking.eventTitle}</p>
              </div>
              <button
                onClick={() => setPayingBooking(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              {payingBooking.expiresAt && (
                <div className="mb-4 flex items-center justify-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
                  <BookingCountdown
                    expiresAt={payingBooking.expiresAt}
                    onExpired={() => markExpired(payingBooking.bookingId)}
                  />
                </div>
              )}

              <div className="space-y-2 mb-5 text-sm">
                {payingBooking.tickets.map(t => (
                  <div key={t.ticketId} className="flex justify-between text-gray-700">
                    <span>{t.seatCode} <span className="text-gray-400">({t.tierName})</span></span>
                    <span>฿{Number(t.price).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-gray-900 border-t pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-indigo-700">฿{Number(payingBooking.totalAmount).toLocaleString()}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment method</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="QR_CODE">QR Code</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="WALLET">Wallet</option>
                </select>
              </div>

              {payError && (
                <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                  </svg>
                  {payError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setPayingBooking(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {paying && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {paying ? 'Processing…' : `Pay ฿${Number(payingBooking.totalAmount).toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
