# NoLife Ticket — Database Ticket Booking System

A full-stack ticketing platform built with PostgreSQL, Spring Boot 3, and React.

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 17 |
| Backend | Java 23, Spring Boot 3, Spring Security 6 (JWT), JPA/Hibernate 6 |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Dev Tools | Docker Compose, Adminer |

---

## Getting Started

### Option A — Docker Compose (recommended)

Runs everything (database, backend, frontend) with one command.

**Prerequisites:** Docker Desktop

```bash
git clone https://github.com/Nuggetkub/Database-Ticket-Booking-System.git
cd Database-Ticket-Booking-System
docker compose up
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8080/api |
| Adminer (DB viewer) | http://localhost:8081 |

---

### Option B — Run Locally (manual)

**Prerequisites:** Java 23+, Maven, Node.js + npm, PostgreSQL

**1. Set up the database**

Create a PostgreSQL database named `ticketing`, then run
```bash
psql -U postgres -d ticketing -f ddl.sql
psql -U postgres -d ticketing -f seed.sql
```

Optionally load realistic demo data (descriptions + 200 booking logs)
```bash
psql -U postgres -d ticketing -f seed_descriptions_and_bookings.sql
```

**2. Start the backend**
```bash
cd ticketing
mvn spring-boot:run
```
Backend runs at http://localhost:8080

**3. Start the frontend** (new terminal)
```bash
cd ticketing-ui
npm install
npm run dev
```
Frontend runs at http://localhost:5173

> Start the backend **before** the frontend.

---

## Project Structure

```
├── ddl.sql                          # Database schema
├── seed.sql                         # Base sample data
├── seed_descriptions_and_bookings.sql  # Demo data: event descriptions + 200 bookings
├── docker-compose.yml               # Docker setup
├── ticketing/                       # Spring Boot backend
│   └── src/main/java/com/ticketing/
│       ├── controller/              # REST endpoints
│       ├── service/                 # Business logic
│       ├── entity/                  # JPA entities
│       ├── repository/              # Data access
│       ├── security/                # JWT auth
│       ├── specification/           # JPA Criteria search filters
│       └── dto/                     # Request/response objects
└── ticketing-ui/                    # React frontend
    └── src/
        ├── pages/                   # Page components
        ├── components/              # Shared UI components
        ├── services/                # API calls
        ├── context/                 # Auth context
        ├── hooks/                   # Custom hooks
        └── types.ts                 # TypeScript types
```

---

## Test Accounts

All accounts use password: `password`

| Role | Email |
|---|---|
| Admin | admin@nugget.com |
| Organizer | wiroj@nugget.com |
| Organizer | siriporn@nugget.com |
| Customer | alice@example.com |
| Customer | bob@example.com |

---

## Features

### Customer
- Browse and search events with filters:
  - Title search (case-insensitive partial match)
  - Age rating toggles (G / PG / PG-13 / R / NC-17)
  - Venue, tags, price range, and date range
  - Active filters shown as removable chips
- View event details modal with full description and showtime list
- Select seats on a venue layout map
- Book tickets (up to the per-person limit per showtime)
- 15-minute payment countdown after booking
- Pay via Credit Card, Debit Card, QR Code, Bank Transfer, or Wallet
- View booking history with ticket breakdown and payment status
- Cancel **pending** bookings (confirmed purchases are non-refundable)

### Organizer
- Create and manage their own events (title, description, duration, age rating, tags, thumbnail)
- Add showtimes with venue, schedule, ticket-per-person limit, and tiered pricing
- Edit event details and showtime settings
- Delete events and showtimes (active bookings are auto-cancelled)
- Venue double-booking prevention

### Admin
- Full access to all events and showtimes
- Manage venues (create, edit, delete with conflict protection)
- Manage user roles (promote/demote between admin, organizer, customer)
- Overview dashboard:
  - Key stats: total revenue, tickets sold this month, active bookings, total users
  - Recent bookings table and upcoming showtimes with fill-rate indicators
- Reports dashboard:
  - **Peak Sales Period** — hourly/daily ticket sales heatmap, filterable by event
  - **Top-Selling Province** — revenue by venue location
  - **Booking-to-Capacity** — fill rate per showtime with visual progress bars
  - **Top Events by Income** — events ranked by total revenue
  - **Top Events by Tickets Sold** — events ranked by ticket count

---

## Age Ratings

Events use MPAA ratings: `G`, `PG`, `PG-13`, `R`, `NC-17`

---

## API Base URL

```
http://localhost:8080/api
```

Key endpoints:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Login |
| POST | `/auth/register` | Public | Register |
| GET | `/events` | Public | List all events |
| GET | `/events/search` | Public | Filter events (title, tags, ratings, venues, price, date) |
| GET | `/events/mine` | Organizer/Admin | My events only |
| POST | `/events` | Organizer/Admin | Create event |
| PUT | `/events/{id}` | Organizer/Admin | Update event |
| DELETE | `/events/{id}` | Organizer/Admin | Delete event |
| POST | `/showtimes` | Organizer/Admin | Create showtime |
| PUT | `/showtimes/{id}` | Organizer/Admin | Update showtime |
| DELETE | `/showtimes/{id}` | Organizer/Admin | Delete showtime |
| GET | `/venues` | Public | List venues |
| GET | `/venues/{id}/layout` | Customer | Seat layout for a showtime |
| POST | `/bookings` | Customer | Create booking |
| POST | `/bookings/{id}/cancel` | Customer | Cancel pending booking |
| GET | `/bookings/history` | Customer | Booking history |
| POST | `/payments` | Customer | Pay for booking |
| GET | `/tags` | Public | List event tags |
| GET | `/admin/users` | Admin | List all users |
| PUT | `/admin/users/{id}/role` | Admin | Change user role |
| GET | `/admin/reports/overview` | Admin | Dashboard overview stats |
| GET | `/admin/reports/peak-sales` | Admin | Peak sales heatmap |
| GET | `/admin/reports/top-region` | Admin | Revenue by province |
| GET | `/admin/reports/capacity` | Admin | Showtime fill rates |
| GET | `/admin/reports/top-events-income` | Admin | Top events by revenue |
| GET | `/admin/reports/top-events-tickets` | Admin | Top events by tickets sold |
