  -- =============================================================================
-- Migration: Tambah kolom yang hilang ke tabel places
-- Jalankan SQL ini di Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- Tambah kolom address
ALTER TABLE places ADD COLUMN IF NOT EXISTS address varchar(500);

-- Tambah kolom phone
ALTER TABLE places ADD COLUMN IF NOT EXISTS phone varchar(20);

-- Tambah kolom opening_time
ALTER TABLE places ADD COLUMN IF NOT EXISTS opening_time time;

-- Tambah kolom closing_time
ALTER TABLE places ADD COLUMN IF NOT EXISTS closing_time time;

-- Tambah kolom rating
ALTER TABLE places ADD COLUMN IF NOT EXISTS rating numeric(3, 1);

-- Tambah kolom google_maps_url
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_maps_url text;

-- Buat tabel reviews jika belum ada
CREATE TABLE IF NOT EXISTS reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id varchar(100) NOT NULL,
  rating numeric(3, 1) NOT NULL CHECK (rating BETWEEN 0 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
