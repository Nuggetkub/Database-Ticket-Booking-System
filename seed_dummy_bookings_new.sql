-- ============================================================
--  DUMMY BOOKINGS — 100 bookings, dynamic across all tiers
--  - Appends to existing data (no truncation)
--  - Booking timestamps spread over 180 days, always BEFORE the showtime
--  - Evening-weighted hours (08-12 / 12-18 / 18-22)
--  - Seat codes: T{tier_id}-XXXXX (starting at 10001, no collision with existing codes)
--  - Status: ~80% CONFIRMED, ~12% CANCELLED, ~8% EXPIRED
--
--  HOW TO ROLL BACK:
--    Option A — run interactively and decide after seeing the summary:
--      psql> BEGIN;
--      psql> \i seed_dummy_bookings_new.sql
--      psql> -- inspect results, then:
--      psql> ROLLBACK;   -- undo everything
--      psql> COMMIT;     -- keep everything
--
--    Option B — note the booking_id range before/after and delete:
--      DELETE FROM bookings WHERE booking_id > <max_id_before_run>;
--      (cascade deletes tickets and payments automatically)
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_total      int := 100;

  -- Tier data loaded dynamically
  v_tier_ids   bigint[];
  v_show_ids   bigint[];
  v_show_ts    timestamptz[];
  v_prices     numeric[];
  v_n          int;
  v_ctrs       int[];       -- seat counters per tier index

  -- Customer users
  v_users      bigint[];
  v_nu         int;

  v_methods    payment_method_type[] :=
    ARRAY['CREDIT_CARD','DEBIT_CARD','QR_CODE','BANK_TRANSFER','WALLET']::payment_method_type[];

  -- Loop vars
  i            int;
  idx          int;
  v_tid        bigint;
  v_stime      timestamptz;
  v_price      numeric;
  v_seat       text;
  v_bid        bigint;
  v_bstatus    booking_status;
  v_tstatus    ticket_status;
  v_uid        bigint;
  v_ts         timestamptz;
  v_window_lo  timestamptz;
  v_window_hi  timestamptz;
  v_span_secs  float;
  v_rand       float;
  v_hour_secs  int;
  v_method     payment_method_type;
  v_generated  int := 0;
  v_attempts   int := 0;
BEGIN
  -- ── 1. Load all tiers with their showtime date ──────────────
  SELECT
    array_agg(t.tier_id        ORDER BY t.tier_id),
    array_agg(t.showtime_id    ORDER BY t.tier_id),
    array_agg(s.show_schedules ORDER BY t.tier_id),
    array_agg(t.price          ORDER BY t.tier_id)
  INTO v_tier_ids, v_show_ids, v_show_ts, v_prices
  FROM tickettiers t
  JOIN showtimes s ON s.showtime_id = t.showtime_id;

  v_n    := array_length(v_tier_ids, 1);
  -- Start seat counters high to avoid colliding with any existing codes
  v_ctrs := array_fill(10001, ARRAY[v_n]);

  -- ── 2. Load customer user IDs ───────────────────────────────
  SELECT array_agg(user_id ORDER BY user_id), COUNT(*)
  INTO v_users, v_nu
  FROM users
  WHERE role_id = (SELECT role_id FROM roles WHERE role_name = 'customer' LIMIT 1);

  IF v_nu = 0 THEN
    RAISE EXCEPTION 'No customer users found. Run seed.sql first.';
  END IF;

  -- ── 3. Generate bookings ────────────────────────────────────
  WHILE v_generated < v_total AND v_attempts < v_total * 20 LOOP
    v_attempts := v_attempts + 1;

    -- Pick a random tier
    idx     := 1 + (random() * (v_n - 1))::int;
    v_tid   := v_tier_ids[idx];
    v_stime := v_show_ts[idx];
    v_price := v_prices[idx];

    -- Booking window: within past 180 days AND before the showtime
    v_window_lo := GREATEST(
      v_stime   - interval '180 days',
      CURRENT_DATE::timestamptz - interval '180 days'
    );
    v_window_hi := LEAST(
      v_stime   - interval '1 hour',
      CURRENT_TIMESTAMP
    );

    -- Skip if no valid window exists for this showtime
    CONTINUE WHEN v_window_lo >= v_window_hi;

    -- Pick a random day within the window
    v_span_secs := EXTRACT(EPOCH FROM (v_window_hi - v_window_lo));
    v_ts := v_window_lo + (random() * v_span_secs * 0.999 || ' seconds')::interval;

    -- Replace time-of-day with evening-weighted hour
    v_rand := random();
    v_hour_secs := CASE
      WHEN v_rand < 0.50 THEN 64800 + (random() * 14399)::int  -- 18:00-21:59
      WHEN v_rand < 0.75 THEN 43200 + (random() * 21599)::int  -- 12:00-17:59
      ELSE                     28800 + (random() * 14399)::int  -- 08:00-11:59
    END;
    v_ts := date_trunc('day', v_ts) + (v_hour_secs || ' seconds')::interval;

    -- Clamp back into window after hour adjustment
    IF v_ts > v_window_hi THEN v_ts := v_window_hi - interval '5 minutes'; END IF;
    IF v_ts < v_window_lo THEN v_ts := v_window_lo; END IF;

    -- Seat code: T{tier_id}-{5-digit-seq} — distinct from existing 2-char alpha codes
    v_seat      := 'T' || v_tid || '-' || LPAD(v_ctrs[idx]::text, 5, '0');
    v_ctrs[idx] := v_ctrs[idx] + 1;

    -- Random customer
    v_uid := v_users[1 + (random() * (v_nu - 1))::int];

    -- Booking status
    v_rand := random();
    IF    v_rand < 0.80 THEN v_bstatus := 'CONFIRMED'; v_tstatus := 'CONFIRMED';
    ELSIF v_rand < 0.92 THEN v_bstatus := 'CANCELLED'; v_tstatus := 'CANCELLED';
    ELSE                     v_bstatus := 'EXPIRED';   v_tstatus := 'CANCELLED';
    END IF;

    v_method := v_methods[1 + (random() * 4)::int];

    INSERT INTO bookings (user_id, timestamp, expires_at, status)
    VALUES (v_uid, v_ts, v_ts + interval '15 minutes', v_bstatus)
    RETURNING booking_id INTO v_bid;

    INSERT INTO tickets (tier_id, booking_id, seat_code, status, price)
    VALUES (v_tid, v_bid, v_seat, v_tstatus, v_price);

    IF v_bstatus = 'CONFIRMED' THEN
      INSERT INTO payments (booking_id, payment_method, amount, status, timestamp)
      VALUES (v_bid, v_method, v_price, 'COMPLETED', v_ts + interval '3 minutes');
    END IF;

    v_generated := v_generated + 1;
  END LOOP;

  RAISE NOTICE 'Done: % bookings created across % tiers (% attempts).', v_generated, v_n, v_attempts;
END;
$$;

-- ── Summary ──────────────────────────────────────────────────
SELECT
  COUNT(*)                                                         AS total_bookings,
  COUNT(*) FILTER (WHERE b.status = 'CONFIRMED')                  AS confirmed,
  COUNT(*) FILTER (WHERE b.status = 'CANCELLED')                  AS cancelled,
  COUNT(*) FILTER (WHERE b.status = 'EXPIRED')                    AS expired,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'COMPLETED'), 0) AS total_revenue
FROM bookings b
LEFT JOIN payments p ON p.booking_id = b.booking_id;

COMMIT;
