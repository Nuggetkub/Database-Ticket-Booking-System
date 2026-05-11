package com.ticketing.service.impl;

import com.ticketing.dto.report.CapacityPoint;
import com.ticketing.dto.report.OverviewResponse;
import com.ticketing.dto.report.PeakSalesPoint;
import com.ticketing.dto.report.RecentBookingDto;
import com.ticketing.dto.report.TopEventPoint;
import com.ticketing.dto.report.TopRegionPoint;
import com.ticketing.dto.report.UpcomingShowtimeDto;
import com.ticketing.service.ReportService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class ReportServiceImpl implements ReportService {

    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional(readOnly = true)
    public List<PeakSalesPoint> getPeakSales(LocalDate startDate, LocalDate endDate, Long eventId) {
        OffsetDateTime start = startDate != null ? startDate.atStartOfDay().atOffset(ZoneOffset.UTC) : null;
        OffsetDateTime end   = endDate   != null ? endDate.atTime(23, 59, 59).atOffset(ZoneOffset.UTC) : null;

        StringBuilder sql = new StringBuilder("""
                SELECT EXTRACT(HOUR FROM b.timestamp)::int AS hour,
                       EXTRACT(DOW  FROM b.timestamp)::int AS dow,
                       COUNT(t.ticket_id)                  AS cnt
                FROM bookings b
                JOIN tickets     t  ON t.booking_id  = b.booking_id
                JOIN tickettiers tt ON tt.tier_id     = t.tier_id
                JOIN showtimes   s  ON s.showtime_id  = tt.showtime_id
                WHERE b.status::text = 'CONFIRMED'
                """);
        if (start   != null) sql.append(" AND b.timestamp >= :start");
        if (end     != null) sql.append(" AND b.timestamp <= :end");
        if (eventId != null) sql.append(" AND s.event_id = :eventId");
        sql.append(" GROUP BY hour, dow ORDER BY hour, dow");

        var query = em.createNativeQuery(sql.toString());
        if (start   != null) query.setParameter("start",   start);
        if (end     != null) query.setParameter("end",     end);
        if (eventId != null) query.setParameter("eventId", eventId);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();

        Map<Integer, Map<Integer, Long>> byHour = new TreeMap<>();
        for (Object[] row : rows) {
            int  hour  = ((Number) row[0]).intValue();
            int  dow   = ((Number) row[1]).intValue();
            long count = ((Number) row[2]).longValue();
            byHour.computeIfAbsent(hour, k -> new HashMap<>()).put(dow, count);
        }
        return byHour.entrySet().stream().map(e -> {
            Map<Integer, Long> d = e.getValue();
            int h = e.getKey();
            return new PeakSalesPoint(h, String.format("%02d:00", h),
                    d.getOrDefault(0, 0L), d.getOrDefault(1, 0L), d.getOrDefault(2, 0L),
                    d.getOrDefault(3, 0L), d.getOrDefault(4, 0L), d.getOrDefault(5, 0L),
                    d.getOrDefault(6, 0L));
        }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TopRegionPoint> getTopRegion(LocalDate startDate, LocalDate endDate) {
        OffsetDateTime start = startDate != null ? startDate.atStartOfDay().atOffset(ZoneOffset.UTC) : null;
        OffsetDateTime end   = endDate   != null ? endDate.atTime(23, 59, 59).atOffset(ZoneOffset.UTC) : null;

        StringBuilder sql = new StringBuilder("""
                SELECT a.province, COUNT(t.ticket_id) AS tickets_sold, COALESCE(SUM(t.price), 0) AS total_income
                FROM bookings b
                JOIN tickets     t  ON t.booking_id  = b.booking_id
                JOIN tickettiers tt ON tt.tier_id     = t.tier_id
                JOIN showtimes   s  ON s.showtime_id  = tt.showtime_id
                JOIN venues      v  ON v.venue_id     = s.venue_id
                JOIN addresses   a  ON a.address_id   = v.address_id
                WHERE b.status::text = 'CONFIRMED'
                """);
        if (start != null) sql.append(" AND s.show_schedules >= :start");
        if (end   != null) sql.append(" AND s.show_schedules <= :end");
        sql.append(" GROUP BY a.province ORDER BY total_income DESC");

        var query = em.createNativeQuery(sql.toString());
        if (start != null) query.setParameter("start", start);
        if (end   != null) query.setParameter("end",   end);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream()
                .map(r -> new TopRegionPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        (BigDecimal) r[2]))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CapacityPoint> getCapacity(LocalDate startDate, LocalDate endDate) {
        OffsetDateTime start = startDate != null ? startDate.atStartOfDay().atOffset(ZoneOffset.UTC) : null;
        OffsetDateTime end   = endDate   != null ? endDate.atTime(23, 59, 59).atOffset(ZoneOffset.UTC) : null;

        StringBuilder sql = new StringBuilder("""
                SELECT event_title, venue_name, show_schedules, total_capacity, booked_tickets,
                       ROUND(booked_tickets::numeric / NULLIF(total_capacity, 0) * 100, 1) AS fill_rate
                FROM (
                    SELECT e.title AS event_title, v.name AS venue_name, s.show_schedules,
                           SUM(tt.total_amount)  AS total_capacity,
                           COUNT(tk.ticket_id)   AS booked_tickets
                    FROM showtimes   s
                    JOIN events      e  ON e.event_id    = s.event_id
                    JOIN venues      v  ON v.venue_id    = s.venue_id
                    JOIN tickettiers tt ON tt.showtime_id = s.showtime_id
                    LEFT JOIN tickets tk ON tk.tier_id   = tt.tier_id
                    LEFT JOIN bookings bk ON bk.booking_id = tk.booking_id AND bk.status::text = 'CONFIRMED'
                    WHERE 1=1
                """);
        if (start != null) sql.append(" AND s.show_schedules >= :start");
        if (end   != null) sql.append(" AND s.show_schedules <= :end");
        sql.append("""
                    GROUP BY e.title, v.name, s.show_schedules, s.showtime_id
                ) sub
                ORDER BY fill_rate DESC NULLS LAST
                """);

        var query = em.createNativeQuery(sql.toString());
        if (start != null) query.setParameter("start", start);
        if (end   != null) query.setParameter("end",   end);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream()
                .map(r -> new CapacityPoint(
                        (String) r[0],
                        (String) r[1],
                        toOffsetDateTime(r[2]),
                        ((Number) r[3]).longValue(),
                        ((Number) r[4]).longValue(),
                        r[5] != null ? ((Number) r[5]).doubleValue() : 0.0))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TopEventPoint> getTopEventsByIncome(LocalDate startDate, LocalDate endDate) {
        return queryTopEvents(startDate, endDate, "total_income DESC");
    }

    @Override
    @Transactional(readOnly = true)
    public List<TopEventPoint> getTopEventsByTickets(LocalDate startDate, LocalDate endDate) {
        return queryTopEvents(startDate, endDate, "tickets_sold DESC");
    }

    private List<TopEventPoint> queryTopEvents(LocalDate startDate, LocalDate endDate, String orderBy) {
        OffsetDateTime start = startDate != null ? startDate.atStartOfDay().atOffset(ZoneOffset.UTC) : null;
        OffsetDateTime end   = endDate   != null ? endDate.atTime(23, 59, 59).atOffset(ZoneOffset.UTC) : null;

        StringBuilder sql = new StringBuilder("""
                SELECT e.title, COUNT(t.ticket_id) AS tickets_sold, COALESCE(SUM(t.price), 0) AS total_income
                FROM bookings b
                JOIN tickets     t  ON t.booking_id  = b.booking_id
                JOIN tickettiers tt ON tt.tier_id     = t.tier_id
                JOIN showtimes   s  ON s.showtime_id  = tt.showtime_id
                JOIN events      e  ON e.event_id     = s.event_id
                WHERE b.status::text = 'CONFIRMED'
                """);
        if (start != null) sql.append(" AND s.show_schedules >= :start");
        if (end   != null) sql.append(" AND s.show_schedules <= :end");
        sql.append(" GROUP BY e.event_id, e.title ORDER BY ").append(orderBy);

        var query = em.createNativeQuery(sql.toString());
        if (start != null) query.setParameter("start", start);
        if (end   != null) query.setParameter("end",   end);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream()
                .map(r -> new TopEventPoint(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        (BigDecimal) r[2]))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public OverviewResponse getOverview() {
        // Total revenue from confirmed bookings
        BigDecimal totalRevenue = (BigDecimal) em.createNativeQuery(
                "SELECT COALESCE(SUM(t.price), 0) FROM bookings b JOIN tickets t ON t.booking_id = b.booking_id WHERE b.status::text = 'CONFIRMED'"
        ).getSingleResult();

        // Tickets sold this month
        long ticketsSoldThisMonth = ((Number) em.createNativeQuery(
                "SELECT COUNT(t.ticket_id) FROM bookings b JOIN tickets t ON t.booking_id = b.booking_id WHERE b.status::text = 'CONFIRMED' AND DATE_TRUNC('month', b.timestamp) = DATE_TRUNC('month', NOW())"
        ).getSingleResult()).longValue();

        // Active bookings (PENDING or CONFIRMED)
        long activeBookings = ((Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM bookings WHERE status::text IN ('PENDING','CONFIRMED')"
        ).getSingleResult()).longValue();

        // Total users
        long totalUsers = ((Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM users"
        ).getSingleResult()).longValue();

        // Recent bookings — last 10
        @SuppressWarnings("unchecked")
        List<Object[]> recentRows = em.createNativeQuery("""
                SELECT b.booking_id, u.first_name || ' ' || u.last_name AS customer_name,
                       e.title AS event_title, b.status::text, COALESCE(SUM(t.price), 0) AS total_amount, b.timestamp
                FROM bookings b
                JOIN users       u  ON u.user_id   = b.user_id
                JOIN tickets     t  ON t.booking_id = b.booking_id
                JOIN tickettiers tt ON tt.tier_id   = t.tier_id
                JOIN showtimes   s  ON s.showtime_id = tt.showtime_id
                JOIN events      e  ON e.event_id   = s.event_id
                GROUP BY b.booking_id, customer_name, event_title, b.status, b.timestamp
                ORDER BY b.timestamp DESC
                LIMIT 10
                """).getResultList();

        List<RecentBookingDto> recentBookings = recentRows.stream().map(r -> new RecentBookingDto(
                ((Number) r[0]).longValue(),
                (String) r[1],
                (String) r[2],
                (String) r[3],
                (BigDecimal) r[4],
                toOffsetDateTime(r[5])
        )).toList();

        // Upcoming showtimes — next 8
        @SuppressWarnings("unchecked")
        List<Object[]> upcomingRows = em.createNativeQuery("""
                SELECT s.showtime_id, e.title AS event_title, v.name AS venue_name, s.show_schedules,
                       SUM(tt.total_amount) AS total_capacity,
                       COUNT(tk.ticket_id)  AS booked_tickets
                FROM showtimes   s
                JOIN events      e  ON e.event_id    = s.event_id
                JOIN venues      v  ON v.venue_id    = s.venue_id
                JOIN tickettiers tt ON tt.showtime_id = s.showtime_id
                LEFT JOIN tickets tk ON tk.tier_id   = tt.tier_id AND tk.status::text != 'CANCELLED'
                WHERE s.show_schedules > NOW()
                GROUP BY s.showtime_id, event_title, venue_name, s.show_schedules
                ORDER BY s.show_schedules ASC
                LIMIT 8
                """).getResultList();

        List<UpcomingShowtimeDto> upcomingShowtimes = upcomingRows.stream().map(r -> new UpcomingShowtimeDto(
                ((Number) r[0]).longValue(),
                (String) r[1],
                (String) r[2],
                toOffsetDateTime(r[3]),
                ((Number) r[4]).longValue(),
                ((Number) r[5]).longValue()
        )).toList();

        return new OverviewResponse(totalRevenue, ticketsSoldThisMonth, activeBookings, totalUsers,
                recentBookings, upcomingShowtimes);
    }

    private OffsetDateTime toOffsetDateTime(Object obj) {
        if (obj instanceof OffsetDateTime odt)          return odt;
        if (obj instanceof java.sql.Timestamp ts)       return ts.toInstant().atOffset(ZoneOffset.UTC);
        if (obj instanceof java.time.LocalDateTime ldt) return ldt.atOffset(ZoneOffset.UTC);
        return OffsetDateTime.parse(obj.toString());
    }
}
