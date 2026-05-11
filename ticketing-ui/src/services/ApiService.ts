import type {
  AuthResponse,
  BookingHistoryItem,
  BookingResponse,
  CreateShowtimePayload,
  Showtime,
  TagDto,
  VenueDetail,
  VenueLayout,
} from '../types';

const BASE = 'http://localhost:8080/api';

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body || `HTTP ${res.status}`;
    try {
      const json = JSON.parse(body);
      message = json.message || json.error || message;
    } catch { /* body was plain text */ }
    throw new Error(message);
  }
  return res.json();
}

// Raw backend shapes
interface BackendEvent {
  eventId: number; title: string;
  tags: { typeId: number; typeName: string }[];
  durationMinutes: number; rating: number; thumbnail: string;
  description: string;
  showtimes: BackendShowtime[];
}
interface BackendShowtime {
  showtimeId: number; eventId: number;
  venue: { venueId: number; name: string; capacity: number };
  showSchedules: string; ticketPerPerson: number;
  tiers: { tierId: number; tierName: string; price: number; totalAmount: number; availableAmount: number }[];
}
interface BackendVenueLayout {
  venueId: number; name: string; capacity: number;
  sections: { tierId: number; tierName: string; price: number; seats: { seatCode: string; isAvailable: boolean }[] }[];
}
interface BackendBookingHistoryItem {
  bookingId: number; status: string; totalAmount: number; expiresAt: string | null;
  showtime: { showSchedules: string; venue: { name: string }; event: { title: string } };
  tickets: { ticketId: number; seatCode: string; tierName: string; price: number; status: string }[];
}

class ApiService {
  login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  register(email: string, password: string, firstName: string, lastName: string) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
  }

  private mapShowtime(e: BackendEvent, s: BackendShowtime): Showtime {
    return {
      showtimeId: s.showtimeId,
      event: {
        eventId: e.eventId, title: e.title, tags: e.tags,
        durationMinutes: e.durationMinutes, rating: e.rating, thumbnail: e.thumbnail,
        description: e.description,
      },
      venue: s.venue,
      showSchedules: s.showSchedules,
      ticketPerPerson: s.ticketPerPerson,
      tiers: s.tiers.map(t => ({
        tierId: t.tierId, tierName: t.tierName, price: t.price,
        totalAmount: t.totalAmount, available: t.availableAmount,
      })),
    };
  }

  /** For the public event-browsing page. Drops events with no showtimes (nothing to show). */
  async getShowtimes(): Promise<Showtime[]> {
    const events = await request<BackendEvent[]>('/events');
    return events.flatMap(e => e.showtimes.map(s => this.mapShowtime(e, s)));
  }

  /** Server-side filtered search for the browse page. */
  async searchEvents(filters: {
    title?: string;
    tagIds?: number[];
    ratings?: string[];
    venueIds?: number[];
    minPrice?: string;
    maxPrice?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Showtime[]> {
    const qs = new URLSearchParams();
    if (filters.title) qs.set('title', filters.title);
    filters.tagIds?.forEach(id => qs.append('tags', String(id)));
    filters.ratings?.forEach(r => qs.append('ratings', r));
    filters.venueIds?.forEach(id => qs.append('venueIds', String(id)));
    if (filters.minPrice) qs.set('minPrice', filters.minPrice);
    if (filters.maxPrice) qs.set('maxPrice', filters.maxPrice);
    if (filters.startDate) qs.set('startDate', filters.startDate);
    if (filters.endDate) qs.set('endDate', filters.endDate);
    const events = await request<BackendEvent[]>(`/events/search?${qs}`);
    let showtimes = events.flatMap(e => e.showtimes.map(s => this.mapShowtime(e, s)));

    // Trim showtimes that don't satisfy the active filters.
    // Backend matches at the event level; we keep only the qualifying showtimes.
    if (filters.startDate)
      showtimes = showtimes.filter(s => s.showSchedules.substring(0, 10) >= filters.startDate!);
    if (filters.endDate)
      showtimes = showtimes.filter(s => s.showSchedules.substring(0, 10) <= filters.endDate!);
    if (filters.minPrice) {
      const min = Number(filters.minPrice);
      showtimes = showtimes.filter(s => s.tiers.some(t => t.price >= min));
    }
    if (filters.maxPrice) {
      const max = Number(filters.maxPrice);
      showtimes = showtimes.filter(s => s.tiers.some(t => t.price <= max));
    }
    if (filters.venueIds && filters.venueIds.length > 0) {
      showtimes = showtimes.filter(s => filters.venueIds!.includes(s.venue.venueId));
    }

    return showtimes;
  }

  /** For the organizer dashboard. Keeps events even when they have no showtimes yet. */
  async getEvents(): Promise<{ eventId: number; title: string; durationMinutes: number; rating: string; thumbnail: string; description: string; tags: { typeId: number; typeName: string }[]; showtimes: Showtime[] }[]> {
    const events = await request<BackendEvent[]>('/events');
    return events.map(e => ({
      eventId: e.eventId,
      title: e.title,
      durationMinutes: e.durationMinutes,
      rating: e.rating,
      thumbnail: e.thumbnail,
      description: e.description,
      tags: e.tags,
      showtimes: e.showtimes.map(s => this.mapShowtime(e, s)),
    }));
  }

  /** Organizer dashboard — only the current user's events. */
  async getMyEvents(): Promise<{ eventId: number; title: string; durationMinutes: number; rating: string; thumbnail: string; description: string; tags: { typeId: number; typeName: string }[]; showtimes: Showtime[] }[]> {
    const events = await request<BackendEvent[]>('/events/mine');
    return events.map(e => ({
      eventId: e.eventId,
      title: e.title,
      durationMinutes: e.durationMinutes,
      rating: e.rating,
      thumbnail: e.thumbnail,
      description: e.description,
      tags: e.tags,
      showtimes: e.showtimes.map(s => this.mapShowtime(e, s)),
    }));
  }

  getUsers(): Promise<{ userId: number; email: string; firstName: string; lastName: string; role: string }[]> {
    return request('/admin/users');
  }

  updateUserRole(userId: number, roleName: string): Promise<{ userId: number; email: string; firstName: string; lastName: string; role: string }> {
    return request(`/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ roleName }) });
  }

  async getVenueLayout(venueId: number, showtimeId: number): Promise<VenueLayout> {
    const raw = await request<BackendVenueLayout>(`/venues/${venueId}/layout?showtimeId=${showtimeId}`);
    const seats = raw.sections.flatMap(sec =>
      sec.seats.map(seat => ({
        seatCode: seat.seatCode,
        tierId: sec.tierId,
        tierName: sec.tierName,
        price: sec.price,
        available: seat.isAvailable,
      }))
    );
    return { venueId: raw.venueId, venueName: raw.name, capacity: raw.capacity, seats };
  }

  createBooking(showtimeId: number, tickets: { tierId: number; seatCode: string }[]) {
    return request<BookingResponse>('/bookings', {
      method: 'POST',
      body: JSON.stringify({ showtimeId, tickets }),
    });
  }

  async getBookingHistory(): Promise<BookingHistoryItem[]> {
    const raw = await request<BackendBookingHistoryItem[]>('/bookings/history');
    return raw.map(b => ({
      bookingId: b.bookingId,
      status: b.status,
      totalAmount: b.totalAmount,
      expiresAt: b.expiresAt,
      eventTitle: b.showtime.event.title,
      venueName: b.showtime.venue.name,
      showSchedules: b.showtime.showSchedules,
      tickets: b.tickets,
    }));
  }

  processPayment(bookingId: number, paymentMethod: string, amount: number) {
    return request('/payments', {
      method: 'POST',
      body: JSON.stringify({ bookingId, paymentMethod, amount }),
    });
  }

  getTags(): Promise<TagDto[]> {
    return request<TagDto[]>('/tags');
  }

  createEvent(data: { title: string; durationMinutes: number; rating: string; thumbnail: string; description: string; tagIds: number[] }) {
    return request('/events', { method: 'POST', body: JSON.stringify(data) });
  }

  updateEvent(id: number, data: { title: string; durationMinutes: number; rating: string; thumbnail: string; description: string; tagIds: number[] }) {
    return request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  updateShowtime(id: number, data: {
    venueId: number; showSchedules: string; ticketPerPerson: number;
    tiers: { tierId?: number; tierName: string; price: number; totalAmount: number }[];
  }) {
    return request(`/showtimes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async cancelBooking(bookingId: number): Promise<void> {
    const res = await fetch(`${BASE}/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) { const body = await res.text(); throw new Error(body || `HTTP ${res.status}`); }
  }

  getVenues(): Promise<VenueDetail[]> {
    return request<VenueDetail[]>('/venues');
  }

  createVenue(data: Omit<VenueDetail, 'venueId'> & Record<string, unknown>): Promise<VenueDetail> {
    return request<VenueDetail>('/venues', { method: 'POST', body: JSON.stringify(data) });
  }

  updateVenue(id: number, data: Record<string, unknown>): Promise<VenueDetail> {
    return request<VenueDetail>(`/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteVenue(id: number): Promise<void> {
    const res = await fetch(`${BASE}/venues/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
  }

  createShowtime(data: CreateShowtimePayload) {
    return request('/showtimes', { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteEvent(id: number): Promise<void> {
    const res = await fetch(`${BASE}/events/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
  }

  async getPeakSales(filters: { startDate?: string; endDate?: string; eventId?: number } = {}) {
    const qs = new URLSearchParams();
    if (filters.startDate) qs.set('startDate', filters.startDate);
    if (filters.endDate)   qs.set('endDate',   filters.endDate);
    if (filters.eventId)   qs.set('eventId',   String(filters.eventId));
    const q = qs.toString();
    return request<{ hour: number; label: string; sun: number; mon: number; tue: number; wed: number; thu: number; fri: number; sat: number }[]>(
      `/admin/reports/peak-sales${q ? `?${q}` : ''}`,
    );
  }

  async getTopRegion(filters: { startDate?: string; endDate?: string } = {}) {
    const qs = new URLSearchParams();
    if (filters.startDate) qs.set('startDate', filters.startDate);
    if (filters.endDate)   qs.set('endDate',   filters.endDate);
    const q = qs.toString();
    return request<{ province: string; ticketsSold: number; totalIncome: number }[]>(
      `/admin/reports/top-region${q ? `?${q}` : ''}`,
    );
  }

  async getCapacity(filters: { startDate?: string; endDate?: string } = {}) {
    const qs = new URLSearchParams();
    if (filters.startDate) qs.set('startDate', filters.startDate);
    if (filters.endDate)   qs.set('endDate',   filters.endDate);
    const q = qs.toString();
    return request<{ eventTitle: string; venueName: string; showSchedules: string; totalCapacity: number; bookedTickets: number; fillRate: number }[]>(
      `/admin/reports/capacity${q ? `?${q}` : ''}`,
    );
  }

  async getTopEventsByIncome(filters: { startDate?: string; endDate?: string } = {}) {
    const qs = new URLSearchParams();
    if (filters.startDate) qs.set('startDate', filters.startDate);
    if (filters.endDate)   qs.set('endDate',   filters.endDate);
    const q = qs.toString();
    return request<{ eventTitle: string; ticketsSold: number; totalIncome: number }[]>(
      `/admin/reports/top-events-income${q ? `?${q}` : ''}`,
    );
  }

  async getTopEventsByTickets(filters: { startDate?: string; endDate?: string } = {}) {
    const qs = new URLSearchParams();
    if (filters.startDate) qs.set('startDate', filters.startDate);
    if (filters.endDate)   qs.set('endDate',   filters.endDate);
    const q = qs.toString();
    return request<{ eventTitle: string; ticketsSold: number; totalIncome: number }[]>(
      `/admin/reports/top-events-tickets${q ? `?${q}` : ''}`,
    );
  }

  async getOverview() {
    return request<{
      totalRevenue: number;
      ticketsSoldThisMonth: number;
      activeBookings: number;
      totalUsers: number;
      recentBookings: {
        bookingId: number;
        customerName: string;
        eventTitle: string;
        status: string;
        totalAmount: number;
        bookedAt: string;
      }[];
      upcomingShowtimes: {
        showtimeId: number;
        eventTitle: string;
        venueName: string;
        showSchedules: string;
        totalCapacity: number;
        bookedTickets: number;
      }[];
    }>('/admin/reports/overview');
  }

  async deleteShowtime(id: number): Promise<void> {
    const res = await fetch(`${BASE}/showtimes/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
  }
}

export const api = new ApiService();
