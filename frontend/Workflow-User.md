# Workflow Pengguna Umum
## App Map Directory Bengkel

---

## Gambaran Umum

Pengguna umum adalah pengendara yang ingin menemukan bengkel terdekat. Mereka tidak perlu login. Seluruh alur berjalan dari satu layar utama (Home) yang menggabungkan peta dan daftar bengkel.

---

## Alur Lengkap

```
Buka App
    │
    ▼
[1] Minta Izin Lokasi
    │
    ├── Ditolak ──► [2] Layar GPS Denied ──► Tap "Coba Lagi" ──► kembali ke [1]
    │
    └── Diterima
          │
          ▼
[3] Layar Home (Peta + Daftar Bengkel)
    │
    ├── Ketik di Search Bar ──► [4] Hasil Pencarian Real-time
    │       │
    │       └── Hapus teks ──► kembali ke [3]
    │
    ├── Tap Chip Kategori ──► [5] Daftar Difilter per Kategori
    │       │
    │       └── Tap "Semua" ──► kembali ke [3]
    │
    ├── Tap Marker di Peta ──► [6] Preview Card Bengkel (inline)
    │       │
    │       ├── Tap "Detail" ──► [7] Detail Bengkel Expanded (inline)
    │       │       │
    │       │       └── Tap "Mulai Navigasi" ──► [8] Layar Navigasi In-App
    │       │                                         │
    │       │                                    (navigasi berjalan)
    │       │                                         │
    │       │                                    ├── Tiba di tujuan ──► [9] Layar Tiba
    │       │                                    │
    │       │                                    └── Tap "Berhenti" ──► kembali ke [3]
    │       │
    │       └── Tap "Mulai Navigasi" ──► [8] Layar Navigasi In-App
    │
    └── Tap Kartu Bengkel di List ──► [6] Preview Card Bengkel (inline)
```

---

## Detail Setiap Langkah

### [1] Minta Izin Lokasi

**Layar:** Loading GPS (full screen)

**Yang terjadi:**
- App menampilkan spinner teal + teks "Mengambil lokasi Anda..."
- Di background, app memanggil `expo-location` untuk minta izin foreground
- Jika izin diterima → ambil koordinat user (lat/lng) → lanjut ke Home
- Jika izin ditolak → tampilkan layar GPS Denied

**Data yang diambil:**
- `userLocation.latitude`
- `userLocation.longitude`

---

### [2] Layar GPS Denied

**Layar:** GPS Denied (full screen)

**Yang ditampilkan:**
- Ikon `map-marker-off` merah besar
- Judul: "Izin Lokasi Diperlukan"
- Deskripsi: penjelasan kenapa lokasi dibutuhkan
- Tombol: **"Coba Lagi"** → jalankan ulang permintaan izin

**Catatan:** App tidak crash, tidak force close. User bisa coba lagi kapan saja.

---

### [3] Layar Home — Default

**Layar:** Home Screen (peta + bottom sheet)

**Yang terjadi saat pertama load:**
1. Peta Google Maps tampil dengan dark style
2. Titik lokasi user muncul di peta (biru)
3. App fetch data bengkel dari Supabase API
4. Marker bengkel muncul di peta (warna per kategori)
5. Bottom sheet slide up dengan animasi
6. Daftar bengkel tampil, diurutkan dari yang terdekat

**Elemen yang tersedia:**
- 🔍 Search bar (floating di atas peta)
- 📍 Tombol My Location (kanan atas)
- 🛡 Tombol Admin (kanan atas, coral) → menuju Login Admin
- Chip filter kategori (horizontal scroll)
- Counter "X bengkel ditemukan"
- Daftar kartu bengkel (nama, kategori, deskripsi singkat, jarak)

**Data yang ditampilkan per kartu:**
- Foto bengkel (dari Supabase Storage) atau placeholder ikon
- Nama bengkel
- Badge kategori (warna per kategori)
- Deskripsi singkat (2 baris)
- Jarak dari user (dihitung dengan Haversine formula)

---

### [4] Pencarian Bengkel

**Trigger:** User mengetik di search bar

**Yang terjadi:**
- Filter daftar bengkel secara real-time berdasarkan nama atau deskripsi
- Marker di peta juga ikut difilter (hanya marker yang cocok yang tampil)
- Counter update: "X bengkel ditemukan"
- Tombol `×` muncul di kanan search bar untuk hapus teks

**Contoh:** Ketik "jaya" → tampilkan semua bengkel yang namanya mengandung "jaya"

**Reset:** Tap `×` atau hapus semua teks → kembali ke daftar penuh

---

### [5] Filter Kategori

**Trigger:** User tap salah satu chip kategori

**Yang terjadi:**
- Chip yang dipilih berubah warna (background teal, teks gelap)
- Daftar bengkel difilter hanya kategori tersebut
- Marker di peta juga difilter
- Counter update

**Kategori yang tersedia:**
- Semua (default)
- Bengkel Mobil 🚗
- Bengkel Motor 🏍
- Tambal Ban 🔧
- Bengkel Resmi ⭐
- Bengkel Umum 🔩

**Reset:** Tap chip "Semua" → tampilkan semua bengkel

**Kombinasi:** Filter kategori + search bisa aktif bersamaan

---

### [6] Preview Card Bengkel

**Trigger:** User tap marker di peta ATAU tap kartu bengkel di list

**Yang terjadi:**
- Peta auto-zoom ke lokasi bengkel yang dipilih (`animateToRegion`)
- Marker yang dipilih membesar + efek pulse
- Bottom sheet berubah: menampilkan **Preview Card** bengkel di bagian atas, daftar bengkel lain di bawah (lebih kecil)

**Preview Card berisi:**
- Foto bengkel (full width, 140px tinggi)
- Nama bengkel (20px bold)
- Badge kategori + jarak (dalam satu baris)
- Alamat (jika ada)
- Deskripsi singkat (2 baris)
- Dua tombol aksi:
  - **"Detail"** (ghost button, teal border) → expand ke detail penuh
  - **"Mulai Navigasi"** (filled button, teal) → langsung mulai navigasi in-app

---

### [7] Detail Bengkel Expanded (Inline)

**Trigger:** User tap tombol "Detail" di Preview Card

**Yang terjadi:**
- Bottom sheet expand ke ~85% tinggi layar
- Peta mengecil ke 15% atas layar
- Peta mini menampilkan rute dari user ke bengkel (Polyline teal dari OSRM)

**Konten yang ditampilkan:**
1. **Foto hero** — full width, 180px
2. **Nama bengkel** — 24px bold
3. **Badge kategori**
4. **3 Stat Card** (sejajar):
   - Jarak dari user (teal)
   - Estimasi waktu tempuh (hijau, dari OSRM `duration`)
   - Kategori (warna kategori)
5. **Deskripsi & Layanan** — teks lengkap
6. **Peta Mini + Rute OSRM** — MapView non-interaktif, Polyline teal
7. **Koordinat Lokasi** — format `lat, lng` monospace

**Tombol aksi (fixed bottom bar):**
- **"Mulai Navigasi"** (full width, teal) → masuk ke Layar Navigasi In-App

**Kembali:** Tap tombol back / collapse → kembali ke Preview Card [6]

---

### [8] Layar Navigasi In-App

**Trigger:** Tap "Mulai Navigasi" dari Preview Card atau Detail

**Layar:** Full-screen navigasi — menggantikan Home sepenuhnya selama navigasi berlangsung.

**Yang terjadi saat masuk:**
1. Fetch rute dari OSRM dengan parameter `steps=true`:
   ```
   GET https://router.project-osrm.org/route/v1/driving/
       {userLng},{userLat};{destLng},{destLat}
       ?overview=full&geometries=geojson&steps=true
   ```
2. Gambar `<Polyline>` teal di peta
3. Mulai `expo-location.watchPositionAsync` (interval ~1 detik, akurasi tinggi)
4. Kamera peta lock ke posisi user (heading-up, auto-follow)

**Layout layar navigasi:**

```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │  ← Panel instruksi (atas, fixed)
│ │  ↰  Belok kiri dalam 200 m  │ │    bg: #2C2C2E, radius bawah 16px
│ │     Jl. Raya Bogor          │ │    ikon maneuver + instruksi + nama jalan
│ └─────────────────────────────┘ │
│                                 │
│   [PETA FULL SCREEN]            │  ← Peta mengisi sisa layar
│                                 │    Kamera follow + rotate sesuai heading
│   ──── (polyline teal)          │    Polyline teal = rute belum dilalui
│   ════ (polyline abu)           │    Polyline abu = rute sudah dilalui
│   🔵 (posisi user, bergerak)    │    Marker user update real-time
│                                 │
│   📍 (marker bengkel tujuan)    │
│                                 │
├─────────────────────────────────┤
│  2.3 km tersisa  •  ±8 menit   │  ← Info bar bawah (fixed)
│                    [Berhenti]   │    jarak + waktu + tombol berhenti
└─────────────────────────────────┘
```

**Panel instruksi (atas):**
- Background `#2C2C2E`, padding 16px, border-radius bawah 16px
- Ikon maneuver (panah arah belok) — 32px, teal
- Teks instruksi: "Belok kiri dalam 200 m" — 18px bold putih
- Nama jalan berikutnya: 14px abu
- Update otomatis saat user mendekati step berikutnya (threshold ~30m)

**Maneuver icons:**

| OSRM type + modifier | Ikon | Teks |
|---|---|---|
| `depart` | `arrow-up` | "Mulai perjalanan" |
| `turn left` | `arrow-top-left` | "Belok kiri" |
| `turn right` | `arrow-top-right` | "Belok kanan" |
| `turn slight left` | `arrow-top-left` | "Belok sedikit ke kiri" |
| `turn slight right` | `arrow-top-right` | "Belok sedikit ke kanan" |
| `turn sharp left` | `arrow-left` | "Belok tajam ke kiri" |
| `turn sharp right` | `arrow-right` | "Belok tajam ke kanan" |
| `continue straight` | `arrow-up` | "Lurus" |
| `arrive` | `map-marker-check` | "Anda telah tiba" |

**Info bar (bawah):**
- Background `#3A3A3C`, padding 16px
- Kiri: jarak tersisa (update real-time)
- Tengah: estimasi waktu tersisa
- Kanan: tombol **"Berhenti"** (ghost button, merah)

**Real-time update loop:**
```
watchPositionAsync callback (~1 detik):
  1. Update posisi marker user di peta
  2. Rotate kamera sesuai heading user
  3. Hitung jarak user ke step berikutnya
  4. Jika jarak < 30m → advance ke step berikutnya → update panel instruksi
  5. Update sisa jarak & waktu di info bar
  6. Tandai koordinat yang sudah dilewati sebagai "dilalui" (warna abu)
  7. Cek apakah user sudah tiba (jarak ke tujuan < 20m) → masuk ke [9]
```

---

### [9] Layar Tiba di Tujuan

**Trigger:** Posisi user dalam radius 20m dari koordinat bengkel tujuan

**Yang terjadi:**
- `watchPositionAsync` di-remove (navigasi berhenti)
- Layar navigasi berubah menampilkan konfirmasi tiba

**Yang ditampilkan:**
- Ikon `map-marker-check` teal besar (64px)
- Teks "Anda telah tiba!" — 24px bold putih
- Nama bengkel tujuan — 16px abu
- Tombol **"Selesai"** (teal, full width) → kembali ke Home

---

### [8b] Berhenti Navigasi (Manual)

**Trigger:** Tap tombol "Berhenti" di info bar navigasi

**Yang terjadi:**
- `Alert.alert` konfirmasi: "Berhenti navigasi?" dengan tombol "Lanjutkan" dan "Berhenti"
- Jika "Berhenti" → `watchPositionAsync` di-remove → kembali ke Home

---

## Ringkasan Tombol & Aksi

| Tombol / Elemen | Lokasi | Aksi |
|---|---|---|
| Coba Lagi | GPS Denied | Minta ulang izin lokasi |
| Search bar | Home (floating) | Filter bengkel real-time |
| Tombol `×` | Search bar | Hapus teks pencarian |
| Tombol My Location | Home (floating kanan) | Zoom peta ke posisi user |
| Tombol Admin 🛡 | Home (floating kanan) | Navigasi ke Login Admin |
| Chip kategori | Bottom sheet | Filter bengkel per kategori |
| Marker di peta | Peta | Tampilkan Preview Card |
| Kartu bengkel | Bottom sheet list | Tampilkan Preview Card + zoom peta |
| Tombol "Detail" | Preview Card | Expand ke Detail Bengkel |
| Tombol "Mulai Navigasi" | Preview Card / Detail | Masuk ke Layar Navigasi In-App |
| Tombol Back / Collapse | Detail Expanded | Kembali ke Preview Card |
| Tombol "Berhenti" | Layar Navigasi | Konfirmasi → kembali ke Home |
| Tombol "Selesai" | Layar Tiba | Kembali ke Home |

---

## Error States

| Kondisi | Yang Ditampilkan |
|---|---|
| GPS ditolak | Layar GPS Denied + tombol Coba Lagi |
| Tidak ada internet | Pesan error + daftar kosong |
| API Supabase gagal | Pesan "Gagal memuat data bengkel" |
| Tidak ada bengkel di DB | Empty state: ikon + teks "Belum ada bengkel terdaftar" |
| Pencarian tidak ada hasil | Empty state: "Bengkel tidak ditemukan" |
| OSRM gagal ambil rute | Pesan "Gagal mengambil rute, coba lagi" + tombol retry |
| GPS sinyal lemah saat navigasi | Panel instruksi menampilkan "Mencari sinyal GPS..." |
