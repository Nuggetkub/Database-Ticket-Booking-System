# Academic Report Outline — NoLife Ticket Booking System

**Project:** Database-Ticket-Booking-System  
**GitHub:** https://github.com/Nuggetkub/Database-Ticket-Booking-System  
**Context:** Database Systems / Software Engineering course report

---

## Chapter 1 — Introduction (บทนำ)

### 1.1 Background & Motivation
- Problems with real-world ticketing systems: concurrent seat contention, complex multi-criteria search, data integrity under simultaneous transactions
- Why a full-stack approach is needed: business rules must be enforced at the database level, not just the application level

### 1.2 Project Objectives
- Build a production-grade ticket booking platform with three distinct user roles (Customer, Organizer, Admin)
- Enforce data integrity using PostgreSQL-level constraints, triggers, and enums — not just application validation
- Provide real-time analytics for administrators (revenue, fill rates, peak sales patterns)

### 1.3 System Scope
- Public event browsing with multi-criteria search
- Customer booking flow: seat selection → booking → 15-minute payment countdown → confirmation
- Organizer tools: event and showtime CRUD with tiered pricing
- Admin dashboard: user management, venue management, sales reports

---

## Chapter 2 — Background & Related Technologies (ทฤษฎีและเทคโนโลยีที่เกี่ยวข้อง)

### 2.1 Three-Tier Architecture
- Separation of concerns: Presentation (React), Business Logic (Spring Boot), Data (PostgreSQL)
- Benefits: independent scalability, testability, maintainability

### 2.2 Frontend Technologies
- React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Recharts
- Client-side state management without an external state library

### 2.3 Backend & Security Technologies
- Spring Boot 3.5, Java 17, Spring Security 6
- Stateless authentication via JWT (JSON Web Token), 24-hour token lifetime
- JPA / Hibernate 6 for ORM; JPA Criteria API for dynamic queries

### 2.4 Database Technologies
- PostgreSQL 17: ENUMs, check constraints, triggers, stored functions
- Docker Compose for containerised deployment
- Adminer for database inspection during development

---

## Chapter 3 — System Design (การออกแบบระบบ)

### 3.1 Software Architecture
- Layered backend architecture: `Controller → Service → Repository → Entity`
- DTO pattern (record classes) to decouple API contracts from entity structure
- Frontend routing implemented as a client-side state machine (no external router library)

### 3.2 Database Design

#### 3.2.1 Entity-Relationship Model & Normalisation
- 10 core tables: `users`, `roles`, `events`, `eventtypes`, `event_type_map`, `venues`, `showtimes`, `tickettiers`, `bookings`, `tickets`, `payments`
- Many-to-many: events ↔ tags via `event_type_map`
- 4 custom PostgreSQL ENUMs: `booking_status`, `ticket_status`, `payment_status`, `payment_method_type`

#### 3.2.2 Database-Level Integrity Rules (Triggers & Constraints)
| Rule | Trigger / Constraint | Description |
|---|---|---|
| Venue double-booking prevention | `fn_check_venue_conflict` | No two showtimes at the same venue overlap in time |
| Tier capacity validation | `trg_check_tier_capacity` | Sum of all tier `total_amount` values cannot exceed venue capacity |
| Seat uniqueness | `trg_check_seat_uniqueness` | A seat code may only be held by one non-cancelled ticket per showtime |
| Payment amount integrity | `trg_check_payment_amount` | Payment amount must equal the sum of non-cancelled ticket prices |

### 3.3 API & Security Design
- RESTful API: stateless, JSON, standard HTTP verbs and status codes
- Role-Based Access Control (RBAC) enforced by `JwtAuthFilter` in the Spring Security filter chain
- Three roles with distinct endpoint permissions: `customer`, `organizer`, `admin`
- CORS configured to allow the React dev server (`localhost:5173`)

---

## Chapter 4 — Implementation & Advanced Techniques (การพัฒนาและเทคนิคขั้นสูง)

### 4.1 Dynamic Multi-Criteria Search (JPA Criteria API)
- `EventSpecification` builds predicates at runtime: title (case-insensitive `LIKE`), age rating (`.in()`), tags, price range, date range
- Venue filter uses an `EXISTS` subquery across `Showtimes` to avoid duplicate event rows in results
- Client-side post-filtering trims showtimes that don't satisfy date/price constraints after the server returns event-level matches

### 4.2 Database-Level Computation for Reports (Native SQL)
- Peak Sales heatmap: `EXTRACT(HOUR FROM timestamp)` and `EXTRACT(DOW FROM timestamp)` pushed down to PostgreSQL, reducing Java-side memory usage
- Overview stats use `DATE_TRUNC('month', timestamp)` for month-to-date ticket counts
- All report queries use `EntityManager` with native SQL for performance-critical aggregations

### 4.3 Client-Side Data Optimisation (GroupedEvent Pattern)
- The backend returns a flat list of `Showtime[]`, each containing its parent `EventInfo`
- The frontend groups these into `GroupedEvent[]` (one entry per event, with a `showtimes[]` array) using a `Map<eventId, GroupedEvent>`
- Avoids adding a separate aggregation endpoint while keeping the event card UI clean

### 4.4 Booking Flow & State Machine
- `EventListPage` manages stage transitions: `list → details → seats → payment → success`
- Payment countdown uses a custom `usePaymentCountdown` hook (real-time timer with expiry callback)
- `PaymentCountdownBanner` shown globally when a booking is in the `payment` stage

---

## Chapter 5 — Features by User Role (ฟีเจอร์ตามบทบาทผู้ใช้งาน)

### 5.1 Customer
- Browse events with advanced filter bar: title search, age rating toggles (G/PG/PG-13/R/NC-17), venue checkboxes, tag selection, price range, date range
- Active filters displayed as removable chips; filter state persisted in URL query parameters
- Event details modal: full description, showtime list with availability and pricing per tier
- Interactive seat selection map, per-showtime per-person ticket limit enforced
- 15-minute payment countdown with automatic booking expiry
- Payment via: Credit Card, Debit Card, QR Code, Bank Transfer, Wallet
- Booking history with live countdown on pending bookings and inline payment modal
- Business rule: confirmed (paid) bookings cannot be cancelled by the customer

### 5.2 Organizer
- Create and edit events: title, description, age rating, duration, thumbnail, tags (multi-select)
- Add and edit showtimes: venue, schedule, ticket-per-person cap, tiered pricing (name, price, capacity per tier)
- Delete events and showtimes (existing confirmed bookings are automatically cancelled)
- Dashboard shows only the organizer's own events; Admin sees all events

### 5.3 Admin
- Overview dashboard: total revenue, tickets sold this month, active bookings, total users
- Recent bookings table and upcoming showtimes with fill-rate indicators
- Reports dashboard:
  - **Peak Sales Period** — heatmap (hour × day-of-week) of ticket purchase timestamps, filterable by event
  - **Top-Selling Province** — revenue and tickets sold grouped by venue province
  - **Booking-to-Capacity** — fill rate progress bars per showtime
  - **Top Events by Income** — ranked by total revenue
  - **Top Events by Tickets Sold** — ranked by ticket count
- Venue management: create, edit, delete venues (with capacity conflict protection)
- User management: view all accounts, promote/demote roles

---

## Chapter 6 — Challenges & Solutions (ความท้าทายและแนวทางแก้ไข)

### 6.1 ORM vs. Database Trigger Conflicts
- **Problem:** Hibernate's `CascadeType.ALL` caused unintended `UPDATE` statements on the `payments` table during booking cancellation, colliding with `trg_check_payment_amount` and returning HTTP 500
- **Solution:** Changed cascade to `CascadeType.REMOVE` so Hibernate only propagates deletes, not updates — aligning ORM behaviour with the trigger's expectations

### 6.2 LazyInitializationException on Admin User Endpoint
- **Problem:** `u.getRole().getRoleName()` was called after the Hibernate session closed in the controller layer
- **Solution:** Added `@Transactional(readOnly = true)` to `AdminUserController.listUsers()` to keep the session open for the full method duration

### 6.3 Filter UI Layout Shift
- **Problem:** The advanced filter panel pushed event cards down when opened, causing jarring layout shift
- **Solution:** Redesigned the panel as an absolutely-positioned overlay (popover), preserving the card grid layout regardless of filter state

### 6.4 Report Query Column Name Mismatch
- **Problem:** Initial report queries referenced `b.booked_at` which does not exist; the actual column is `b.timestamp`
- **Solution:** Audited `ddl.sql` to confirm column names before writing native SQL queries

### 6.5 Character Encoding on Thai Windows
- **Problem:** PowerShell's default `Get-Content` on a Thai-locale Windows machine (Windows-874 code page) misread UTF-8 multi-byte sequences: `฿` (U+0E3F, bytes `E0 B8 BF`) was re-encoded as `เธฟ`; the `🎫` emoji was similarly corrupted
- **Solution:** All file read/write operations now use `[System.IO.File]::ReadAllText/WriteAllText` with explicit `System.Text.Encoding.UTF8` and no BOM

---

## Chapter 7 — Conclusion & Future Work (บทสรุปและข้อเสนอแนะ)

### 7.1 Summary of Achievements
- Delivered a complete full-stack ticketing system with production-grade concerns: RBAC, database-enforced integrity, real-time countdown, and analytics
- Demonstrated that pushing business rules to the database layer (triggers, constraints, enums) provides stronger guarantees than application-level validation alone
- Showed how JPA Criteria API enables complex dynamic search without raw SQL while remaining type-safe

### 7.2 Lessons Learned
- ORM and hand-written triggers must be designed together — cascade settings need to reflect the trigger's assumptions
- Client-side grouping (GroupedEvent) can eliminate unnecessary API endpoints when the flat data structure is already sufficient
- URL query parameter synchronisation is essential for shareable, bookmarkable filter states

### 7.3 Future Improvements
- **Concurrency hardening:** Add optimistic locking (`@Version`) on `TicketTier` to handle simultaneous seat selection races under high load
- **Caching:** Cache report query results (e.g., with Redis) since historical aggregations don't change frequently
- **Email notifications:** Send booking confirmation and payment receipt emails via an async message queue
- **QR ticket delivery:** Generate a unique QR code per ticket for venue check-in scanning
- **Database migration tool:** Adopt Flyway or Liquibase to manage schema evolution instead of manual `ddl.sql` reruns

---

## Appendix Suggestions

- **A — Database Schema Diagram (ERD)**
- **B — API Endpoint Reference Table** (from README)
- **C — Key Trigger & Function Source Code** (`fn_check_seat_uniqueness`, `fn_check_payment_amount`, `fn_check_tier_capacity`)
- **D — Test Account Credentials**
- **E — Sample SQL Queries** (peak sales report, fill rate calculation)
