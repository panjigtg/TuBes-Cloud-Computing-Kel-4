# Direktori Bengkel - Android Map Directory

## Cloud Computing Project

## Project Overview

### Project Name

Direktori Bengkel / Android Map Directory

### Purpose

Aplikasi direktori berbasis peta untuk menemukan tempat (bengkel) di sekitar lokasi pengguna dan membuka rute langsung dari HP menggunakan GPS dan map intent.

### Context Problem

Mahasiswa/pengguna sering membutuhkan informasi cepat tentang bengkel terdekat. Informasi lokasi sering tersebar di grup chat, media sosial, atau pengetahuan teman. Aplikasi perlu memberi daftar tempat, detail, jarak, dan rute secara langsung.

### Learning Objectives

1. **Cloud Backend**: Membangun server/API yang dapat diakses dari aplikasi mobile melalui internet
2. **REST API**: Aplikasi mobile berkomunikasi dengan backend melalui endpoint API (JSON over HTTPS)
3. **Database**: Menyimpan data bengkel, kategori, koordinat, rating, dan foto secara terstruktur
4. **GPS & Map**: Aplikasi mengambil lokasi pengguna, menghitung jarak, menampilkan marker, dan membuka rute
5. **Cloud Deployment**: Backend dipublikasikan agar benar-benar dapat dipanggil dari HP
6. **End-to-End Integration**: Integrasi antara mobile app, server cloud, API, database, dan GPS

## Mandatory Architecture

**Three separate layers (REQUIRED):**

```
┌─────────────────────┐
│   Android App UI    │  (Kotlin/Java/Flutter)
│   GPS, Map, List    │
└──────────┬──────────┘
           │ REST API (JSON over HTTPS)
┌──────────▼──────────┐
│  Backend API Server │  (Node.js, Flask, Laravel, etc)
│  Business Logic     │
└──────────┬──────────┘
           │ Database Query/Update
┌──────────▼──────────┐
│  Database           │  (MySQL, PostgreSQL, Firebase, MongoDB)
│  Places, Categories │
└─────────────────────┘
```

**Key Principle**: Android app TIDAK boleh langsung akses database. Semua komunikasi harus melalui API.

## Chosen Stack

Dokumen ini mengadaptasi konsep umum **Android Map Directory** pada PDF menjadi domain khusus: **Direktori Bengkel**.

### Mobile App

- **React Native** + **Expo** (atau bisa Kotlin/Java/Flutter)
  - Fitur: map SDK, GPS permission, list view, detail screen, location tracking
  - `react-native-maps` untuk peta
  - Geolocation API untuk GPS
  - Intent untuk routing

### Backend API

- **Node.js** + **Express**
  - REST endpoints untuk CRUD bengkel
  - JSON response
  - Error handling
  - Input validation

### Database

- **Supabase PostgreSQL**
  - Collections/Tables: categories, places, reviews
  - Credential database hanya disimpan di backend, bukan di aplikasi mobile

### Cloud Deployment

- **Render Free** untuk deploy backend API
- **Supabase Free** untuk database
  - Backend HARUS online dan accessible dari internet

### Map & Routing

- `react-native-maps` dengan OpenStreetMap sources
- Map intent untuk rute (via koordinat)

## Data Model

### Database Schema

```sql
-- Categories Table
CREATE TABLE categories (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  icon VARCHAR(255)
);

-- Places Table
CREATE TABLE places (
  id INT PRIMARY KEY,
  category_id INT FOREIGN KEY,
  name VARCHAR(255),
  address VARCHAR(500),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  description TEXT,
  phone VARCHAR(20),
  opening_time TIME,
  closing_time TIME,
  photo_url VARCHAR(500),
  rating DECIMAL(3, 1),
  created_at TIMESTAMP
);

-- Reviews / Favorites Table (Optional)
CREATE TABLE reviews (
  id INT PRIMARY KEY,
  place_id INT FOREIGN KEY,
  user_id VARCHAR(100),
  rating DECIMAL(3, 1),
  comment TEXT,
  created_at TIMESTAMP
);
```

### Minimum Data Requirements

- **Koordinat (latitude, longitude)** adalah wajib - tanpa itu marker tidak bisa ditampilkan dan rute tidak bisa dibuka
- Minimal **15-30 places** dengan koordinat valid
- Setiap place harus punya category_id yang valid

## REST API Design

### Mandatory Endpoints

| Method | Endpoint                    | Function             | Response             |
| ------ | --------------------------- | -------------------- | -------------------- |
| GET    | `/api/places`               | Ambil semua places   | Array of places      |
| GET    | `/api/places?category={id}` | Filter by category   | Array of places      |
| GET    | `/api/places/{id}`          | Detail satu place    | Single place object  |
| GET    | `/api/categories`           | Ambil semua kategori | Array of categories  |
| POST   | `/api/places`               | Tambah place (admin) | Created place object |

### Example Response Format (JSON)

```json
{
  "id": 1,
  "name": "Bengkel Jaya",
  "category_id": 2,
  "category_name": "Bengkel Mobil",
  "address": "Jl. Raya No. 123",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "description": "Bengkel terpercaya dengan teknisi berpengalaman",
  "phone": "081234567890",
  "opening_time": "08:00",
  "closing_time": "17:00",
  "photo_url": "https://...",
  "rating": 4.5
}
```

## Features Breakdown

### Fitur Wajib (MVP)

1. **Direktori Tempat**
   - Daftar semua bengkel dengan nama, kategori, alamat, koordinat, jam buka
   - Display jarak dari user location
   - Show rating

2. **Map & Marker**
   - Marker untuk setiap place ditampilkan pada peta
   - Berdasarkan latitude & longitude dari API
   - Tap marker untuk lihat popup

3. **GPS & Lokasi**
   - Aplikasi meminta izin lokasi
   - Membaca lokasi pengguna secara real-time
   - Handle kondisi GPS mati dengan pesan error

4. **Detail Place**
   - Nama, kategori, alamat, nomor, jam kerja
   - Deskripsi, foto, rating

5. **Routing**
   - Tombol "Buka Rute" membuka aplikasi maps dengan koordinat tujuan
   - Intent URL: `https://maps.google.com/maps?q={lat},{lng}` atau sesuai platform

6. **Admin Panel** (Opsional tapi recommended)
   - Halaman web sederhana untuk tambah/edit places
   - Form: nama, kategori, alamat, koordinat, jam, foto

### Fitur Tambahan (Opsional)

- Pencarian & filter by kategori/jarak/rating
- Favorit / bookmark
- Review & rating from users
- Distance calculation
- Offline mode

## User Scenarios

### Primary Scenario (HARUS berjalan)

1. Buka aplikasi
2. Izinkan GPS
3. Pilih kategori atau cari bengkel
4. Lihat detail (nama, alamat, jam, jarak, rating)
5. Buka rute

### Contoh Use Case

Mahasiswa baru mencari bengkel motor terdekat → lihat daftar dengan jarak → tap detail → lihat rating dan jam kerja → tap "Buka Rute" → aplikasi maps membuka dengan navigasi ke bengkel.

## Architecture Clean Code Structure

Untuk React Native + Express + Supabase:

```
/ (repo root)
├─ mobile/                  # React Native Expo app
│  ├─ src/
│  │  ├─ screens/          # HomeScreen, DetailScreen, MapScreen
│  │  ├─ components/       # PlaceCard, MapView, LocationPerm
│  │  ├─ services/         # API client, GPS service
│  │  ├─ hooks/            # useLocation, usePlaces
│  │  ├─ utils/            # distance calc, formatting
│  │  └─ navigation/        # stack navigator
│  ├─ app.json             # Expo config
│  └─ package.json
│
├─ backend/                 # Express API server
│  ├─ routes/              # /api/places, /api/categories
│  ├─ controllers/         # business logic
│  ├─ middleware/          # validation, error handling
│  ├─ db/                  # koneksi Supabase
│  ├─ server.js            # entry point
│  └─ package.json
│
├─ database/               # SQL schema / seed untuk Supabase
│
└─ README.md
```

## Testing & Demo Requirements

### API Testing (dengan Postman / Browser)

- [ ] GET /api/places → returns array of places
- [ ] GET /api/places?category=1 → filters correctly
- [ ] GET /api/places/1 → returns single place detail
- [ ] GET /api/categories → returns array of categories
- [ ] POST /api/places → admin dapat tambah place baru

### GPS Testing

- [ ] Aplikasi meminta permission lokasi (Android permission dialog)
- [ ] Aplikasi membaca lokasi pengguna
- [ ] Error handling jika GPS mati
- [ ] Distance calculation akurat

### Connection Testing

- [ ] Clear error message jika server down
- [ ] Clear error message jika no internet
- [ ] Clear error message jika response kosong

### Data Testing

- [ ] Minimal 15-30 places memiliki koordinat valid
- [ ] Setiap place muncul sebagai marker pada peta
- [ ] Rating dan jam kerja terlihat dengan jelas

### Routing Testing

- [ ] Saat place dipilih, tombol "Buka Rute" membuka aplikasi maps
- [ ] Koordinat tujuan terkirim dengan benar ke maps

### Demo Akhir (dari HP/Emulator)

- [ ] Buka aplikasi → terlihat home screen dengan list
- [ ] Tap map view → peta dengan markers muncul
- [ ] Tap marker / place → detail screen
- [ ] Tap "Buka Rute" → navigasi maps terbuka
- [ ] Network call terlihat di browser DevTools atau Postman log

## Development Timeline

| Minggu  | Deliverable                                                                   |
| ------- | ----------------------------------------------------------------------------- |
| **1**   | Definisi domain, fitur, data schema, API design, minimal data (15 places)     |
| **2**   | Backend API setup, test endpoints dengan Postman, database populated          |
| **3-4** | Mobile app UI: list screen, detail screen, map view dengan markers            |
| **5-6** | Integrasi: GPS, location tracking, routing intent, error handling, deployment |
| **7**   | Testing, dokumentasi, demo video, presentasi akhir                            |

## Deliverables & Grading (Bobot)

| Component                          | Bobot | Apa yang dinilai                                                                |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------- |
| **Aplikasi Android/React Native**  | 35%   | UI berjalan, peta tampil, marker muncul, detail jelas, rute bisa dibuka         |
| **Backend, API, Cloud Deployment** | 25%   | Server online, endpoint rapi, JSON response benar, error ditangani              |
| **Database & Data**                | 15%   | Schema sesuai, koordinat valid, data cukup, kategori jelas, 15-30 places        |
| **Dokumentasi & Demo**             | 15%   | Presentasi, diagram arsitektur, bukti testing (screenshot/video), demo berjalan |
| **Dokumen HKI**                    | 10%   | Dokumen yang diperlukan untuk pendaftaran HKI                                   |

**Kesuksesan Proyek**: Aplikasi mobile, API, database, server cloud, dan GPS dapat bekerja sebagai satu sistem end-to-end.

## Security & Quality Notes

- **API Key & Credential**: Jangan simpan password database di aplikasi Android
- **HTTPS**: Gunakan koneksi aman terutama jika online
- **Validasi Data**: Backend harus validate input
- **Error Handling**: Android harus display friendly error messages
- **Privacy**: Lokasi user cukup untuk jarak/rute saja, tidak perlu stored
