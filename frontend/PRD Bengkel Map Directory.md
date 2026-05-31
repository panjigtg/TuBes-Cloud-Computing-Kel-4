# Product Requirements Document (PRD)

| | |
|---|---|
| **Nama Produk** | App Map Directory Bengkel |
| **Platform** | Android (React Native / Expo SDK 54) |
| **Backend & Database** | Supabase (PostgreSQL, Storage, Auth) |
| **Mata Kuliah** | Cloud Computing |
| **Versi Dokumen** | 2.1 |

---

## 1. Ringkasan Produk

Aplikasi direktori berbasis peta yang dirancang khusus untuk membantu pengguna menemukan lokasi bengkel di sekitar mereka. Aplikasi ini mendemonstrasikan implementasi Cloud Computing melalui integrasi antara aplikasi mobile, REST API (via Supabase), Database Cloud, File Storage, dan pemrosesan GPS untuk mencari bengkel terdekat serta menampilkan rutenya.

> **Inti penilaian:** bukan hanya tampilan Android, melainkan integrasi end-to-end antara mobile app, server cloud, REST API, database, dan GPS yang berjalan sebagai satu sistem utuh dan dapat didemonstrasikan langsung dari HP/emulator.

**Komponen wajib (sesuai ketentuan proyek):** Android · Server · REST API · Database · GPS · Map Routing

---

## 2. Target Pengguna

| Persona | Kebutuhan |
|---|---|
| **Pengguna Umum (Pengendara)** | Informasi cepat bengkel terdekat, foto/detail bengkel, jarak dari lokasi saat ini, dan rute navigasi menuju bengkel. |
| **Admin** | Mengelola direktori bengkel: tambah data lokasi baru (koordinat lat/lng, alamat, kategori, foto terkompresi). |

---

## 3. Arsitektur & Tech Stack

### Prinsip Arsitektur

> Aplikasi Android **TIDAK** mengakses database secara langsung. Seluruh data diambil melalui REST API (PostgREST milik Supabase) dalam format JSON over HTTPS, agar sistem aman, terkontrol, dan mudah dikembangkan.

### Alur Arsitektur

```
Android App (UI, GPS, Map)
        │
        ├──► REST API (JSON/HTTPS) ──► Cloud Server (Supabase) ──► Database (places, categories)
        │
        └──► OSRM Routing API (JSON/HTTPS) ──► Polyline + Steps instruksi turn-by-turn
                                                digambar & dijalankan di dalam aplikasi
```

### Komponen

| Komponen | Teknologi |
|---|---|
| **Frontend** | React Native + Expo SDK 54 |
| **Peta** | `react-native-maps` (marker bengkel) |
| **GPS** | `expo-location` (koordinat user real-time) |
| **Kalkulasi Jarak** | Haversine formula (JavaScript, `src/utils/distance.js`) |
| **Backend & API** | Supabase JS Client via REST API PostgREST |
| **Database** | Supabase PostgreSQL (cloud) |
| **File Storage** | Supabase Storage (bucket `bengkel-photos`) |
| **Pemrosesan Foto** | `expo-image-picker` + `expo-image-manipulator` (resize + kompresi JPEG/WEBP). *Catatan: AVIF tidak didukung expo-image-manipulator SDK 54.* |
| **Routing In-App** | OSRM public server (`router.project-osrm.org`) — gratis, tanpa API key, berbasis OpenStreetMap. Response dengan `steps=true` untuk instruksi turn-by-turn. Rute digambar sebagai `<Polyline>` di `react-native-maps`. |
| **Navigasi Real-time** | `expo-location` `watchPositionAsync` — update posisi user setiap ~1 detik dengan akurasi tinggi. Kamera peta auto-follow + rotate sesuai heading. |
| **Routing Fallback** | Tidak ada — navigasi sepenuhnya in-app. |
| **Deployment** | Supabase (sudah online, dapat dipanggil dari HP). Aplikasi via Expo Go atau APK. |

---

## 4. Kebutuhan Fitur

### A. Fitur Wajib — Pengguna Umum

#### 1. Izin Lokasi & GPS
- Aplikasi wajib meminta izin akses lokasi (Foreground) saat pertama kali dibuka.
- Aplikasi mengambil latitude dan longitude pengguna saat ini secara real-time.
- Jika izin ditolak, aplikasi menampilkan pesan yang jelas dan tidak crash.

#### 2. Peta & Marker Bengkel
- Menampilkan UI Google Maps di layar utama.
- Fetch data bengkel dari Supabase API dan render sebagai `Marker` di peta berdasarkan lat/lng.

#### 3. Pencarian, Filter & Daftar Bengkel
- Search bar untuk mencari nama bengkel.
- Filter daftar berdasarkan kategori.
- Daftar bengkel dalam bentuk kartu (List/Bottom Sheet).
- Setiap kartu menampilkan estimasi jarak (meter/kilometer) dari GPS user ke bengkel.

#### 4. Detail Bengkel
Saat bengkel diklik, menampilkan:
- Nama bengkel, kategori, alamat, foto (dari Supabase Storage URL), deskripsi/layanan, rating (jika tersedia), dan jarak.

#### 5. Navigasi In-App dengan Turn-by-Turn *(via OSRM)*

Fitur navigasi berjalan **sepenuhnya di dalam aplikasi** tanpa membuka Google Maps. Terdapat layar navigasi tersendiri yang aktif saat user memulai perjalanan.

**Komponen navigasi:**
- Peta full-screen dengan garis rute **Polyline** teal dari OSRM.
- **Posisi user bergerak real-time** mengikuti GPS (`expo-location` watch position).
- **Kamera peta auto-follow** posisi user (heading-up orientation).
- **Panel instruksi** di bagian atas layar menampilkan instruksi langkah berikutnya.
- **Progress rute** — bagian rute yang sudah dilalui berubah warna (abu) secara otomatis.
- **Info bar** di bagian bawah: estimasi jarak tersisa + estimasi waktu tempuh.

**Alur fetch rute dari OSRM:**
```
GET https://router.project-osrm.org/route/v1/driving/
    {userLng},{userLat};{destLng},{destLat}
    ?overview=full&geometries=geojson&steps=true

Response:
  → geometry.coordinates  → array koordinat untuk Polyline
  → legs[0].steps         → array instruksi belok (maneuver)
  → legs[0].distance      → total jarak (meter)
  → legs[0].duration      → estimasi waktu (detik)
```

**Alur real-time saat navigasi:**
```
expo-location.watchPositionAsync (interval 1 detik, akurasi tinggi)
  → Update posisi marker user di peta
  → Update kamera peta (follow + rotate sesuai heading)
  → Cek step mana yang paling dekat dengan posisi user
  → Update instruksi di panel atas
  → Update sisa jarak & waktu
  → Tandai bagian rute yang sudah dilalui (warna abu)
```

**Format instruksi dari OSRM steps:**
- `maneuver.type`: "turn", "depart", "arrive", "straight", dll.
- `maneuver.modifier`: "left", "right", "slight left", "sharp right", dll.
- `distance`: jarak ke instruksi berikutnya (meter)
- Contoh tampilan: **"Belok kiri dalam 200 m"**, **"Lurus 500 m"**, **"Anda telah tiba"**

---

### B. Fitur Admin — Dashboard / Data Entry

#### 1. Autentikasi Admin
- Login dengan email dan password via Supabase Auth.
- Kredensial demo — password: `admin123`
- Catatan keamanan: kredensial database **tidak** disimpan di aplikasi. Hanya anon key publik Supabase yang digunakan di client.

#### 2. Form Tambah Bengkel Baru
- Input teks: Nama Bengkel, Deskripsi, Kategori, Alamat.
- Input lokasi: Latitude dan Longitude.
- Input foto: pilih dari galeri (`expo-image-picker`), resize + kompresi JPEG (`expo-image-manipulator`), lalu upload.

#### 3. Kelola Data (CRUD Ringan)
- Lihat daftar bengkel yang sudah ada.
- Hapus data bengkel.

#### 4. Proses Upload Data
1. Upload foto terkompresi ke Supabase Storage bucket `bengkel-photos`.
2. Terima Public URL foto.
3. Simpan semua data (teks, alamat, koordinat, URL foto) ke tabel `places`.
4. Validasi: koordinat tidak boleh kosong dan harus berupa angka valid.

---

## 5. Skema Database

> **Catatan:** Koordinat latitude dan longitude adalah inti aplikasi. Tanpa koordinat, data tidak dapat ditampilkan sebagai marker dan tidak dapat digunakan untuk navigasi.

### Tabel `categories`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Contoh: Bengkel Mobil, Bengkel Motor, Tambal Ban |
| `icon_name` | text | Opsional — nama ikon vector untuk UI |

### Tabel `places`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | Primary key |
| `created_at` | timestamp | Auto-generated |
| `category_id` | uuid | Foreign key → `categories` |
| `name` | text | Nama bengkel |
| `description` | text | Deskripsi layanan |
| `address` | text | Opsional — alamat bengkel |
| `latitude` | float8 | **WAJIB** |
| `longitude` | float8 | **WAJIB** |
| `rating` | float8 | Opsional — rata-rata rating (default null) |
| `photo_url` | text | URL gambar dari Supabase Storage |

### Tabel `reviews` *(Opsional — fitur tambahan)*

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid | Primary key |
| `place_id` | uuid | Foreign key → `places` |
| `user_id` | uuid | ID pengguna |
| `rating` | integer | Nilai 1–5 |
| `comment` | text | Opsional |
| `created_at` | timestamp | Auto-generated |

---

## 6. Desain REST API

Supabase JS Client menghasilkan endpoint REST otomatis via PostgREST.

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/places` | Ambil semua bengkel |
| `GET` | `/places?category_id=eq.{id}` | Filter bengkel by kategori |
| `GET` | `/places?id=eq.{id}` | Detail satu bengkel |
| `GET` | `/categories` | Ambil semua kategori |
| `POST` | `/places` | Tambah bengkel baru (admin) |
| `DELETE` | `/places?id=eq.{id}` | Hapus bengkel (admin) |

**Format respons JSON minimal:**
```json
{
  "id": "uuid",
  "name": "string",
  "category": "string",
  "address": "string",
  "latitude": 0.0,
  "longitude": 0.0,
  "description": "string",
  "rating": 0.0,
  "photo_url": "string"
}
```

---

## 7. Daftar Layar (UI/UX Screens)

> Detail lengkap layout, komponen, warna, dan interaksi setiap layar tersedia di **[UI Design Guide](./UI-Design-Guide.md)**.

Aplikasi memiliki **7 screen** (4 screen utama + 3 screen tambahan yang perlu ditambahkan) dan **2 state layar penuh**:

### 👤 Alur Pengguna Umum

| # | Screen | Route Name | Status | Deskripsi | Dapat Diakses Dari |
|---|---|---|---|---|---|
| 1a | **Loading GPS** | *(state Home)* | ✅ Ada | Layar penuh spinner saat app meminta & menunggu izin lokasi. | Otomatis saat Home dibuka |
| 1b | **GPS Denied** | *(state Home)* | ✅ Ada | Layar penuh pesan error + tombol "Coba Lagi" jika izin lokasi ditolak. | Otomatis jika izin ditolak |
| 1 | **Home** | `Home` | ✅ Ada | Peta Google Maps + bottom sheet daftar bengkel + search bar + filter kategori. | Entry point |
| 2 | **Detail Bengkel** | `Detail` | ✅ Ada | Foto hero, info bengkel, jarak, deskripsi, koordinat, peta mini rute OSRM, tombol Google Maps. | Tap marker / tap kartu di Home |

### 🔐 Alur Admin

| # | Screen | Route Name | Status | Deskripsi | Dapat Diakses Dari |
|---|---|---|---|---|---|
| 3 | **Login Admin** | `Login` | ✅ Ada | Form email + password via Supabase Auth. | Tap ikon admin di Home |
| 4 | **Dashboard — Tab Tambah Bengkel** | `AdminDashboard` | ✅ Ada | Form input data bengkel baru + upload foto. | Setelah login berhasil |
| 5 | **Dashboard — Tab Daftar Bengkel** | `AdminDashboard` | ✅ Ada | List semua bengkel dengan opsi hapus. | Tab di Dashboard |
| 6 | **Edit Bengkel** | `EditBengkel` | 🔲 Perlu ditambah | Form edit data bengkel yang sudah ada (nama, deskripsi, kategori, koordinat, foto). | Tap ikon edit di kartu daftar bengkel |
| 7 | **Detail Bengkel (Admin View)** | `AdminDetailBengkel` | 🔲 Perlu ditambah | Lihat detail lengkap bengkel sebelum edit/hapus, dengan preview foto dan semua data. | Tap kartu di daftar bengkel (admin) |

### Alur Navigasi

```
[App Start]
     │
     ├─(GPS loading)─► Loading GPS State
     ├─(GPS denied)──► GPS Denied State ──(coba lagi)──► Loading GPS
     │
     ▼
  Home ──(tap marker / tap kartu)──────────────────► Detail Bengkel
     │                                                      │
     │                                               (tombol back)
     │                                                      │
  (tap ikon admin)                                          ▼
     │                                                    Home
     ▼
   Login ──(login berhasil)──► Dashboard Admin
                                  │         │
                             [Tab 1]     [Tab 2]
                          Tambah Baru   Daftar Bengkel
                                            │
                                    (tap kartu bengkel)
                                            │
                                            ├──► Detail Bengkel (Admin View)
                                            │         │
                                            │    (tap edit)
                                            │         │
                                            │         ▼
                                            └──► Edit Bengkel
                                                      │
                                               (simpan / batal)
                                                      │
                                                      ▼
                                               Daftar Bengkel
```

---

## 8. Keamanan & Kualitas Layanan

| Aspek | Ketentuan |
|---|---|
| **API Key & Credential** | Password/secret database tidak disimpan di aplikasi Android. Hanya anon key publik Supabase yang ada di client. |
| **HTTPS** | Seluruh komunikasi API (Supabase & OSRM) menggunakan koneksi aman HTTPS. |
| **Validasi Data** | Input koordinat tidak boleh kosong dan harus berupa angka valid. Kategori harus sesuai data yang ada. |
| **Error Handling** | Tampilkan pesan jelas jika: GPS mati, izin ditolak, API gagal, internet tidak tersedia, atau data kosong. |
| **Scalability** | Pemisahan app, API, dan database agar mudah menambah fitur (review, analitik) di kemudian hari. |
| **Privacy GPS** | Lokasi user hanya dipakai sementara untuk jarak/rute, tidak disimpan. |

---

## 9. Kebutuhan Data

- Minimal **15–30 data bengkel** dengan koordinat valid yang muncul sebagai marker pada peta.
- Minimal beberapa kategori tersedia (contoh: Bengkel Mobil, Bengkel Motor, Tambal Ban, Bengkel Resmi).

---

## 10. Kriteria Penerimaan

- [ ] Aplikasi berjalan lancar di perangkat Android (via Expo Go atau APK).
- [ ] Aplikasi meminta izin lokasi dan menampilkan pesan jelas jika izin/GPS tidak tersedia (tidak crash).
- [ ] Data marker bengkel berhasil ditarik secara dinamis dari Supabase melalui API.
- [ ] Minimal 15–30 bengkel dengan koordinat valid tampil sebagai marker pada peta.
- [ ] Endpoint API (`places`, `categories`, `places by id`) mengembalikan JSON benar dan dapat diakses dari jaringan luar.
- [ ] Aplikasi menghitung dan menampilkan jarak antara user dan bengkel secara akurat.
- [ ] Pencarian dan filter kategori berfungsi pada daftar bengkel.
- [ ] Garis rute (Polyline) berhasil digambar di dalam peta menggunakan data dari OSRM Routing API.
- [ ] Tombol "Buka di Google Maps" berhasil membuka navigasi di Google Maps (fallback).
- [ ] Admin dapat login, upload foto, dan simpan data bengkel baru yang langsung muncul di peta user.
- [ ] Aplikasi memberi pesan jelas saat server down, internet mati, atau response kosong.

---

## 11. Rencana Pengujian & Demo

| Uji | Kriteria |
|---|---|
| **Uji API** | Endpoint `places`, `categories`, `places/{id}` berjalan dari jaringan luar dan memberi JSON benar. |
| **Uji Data** | Minimal 15–30 bengkel dengan koordinat valid muncul sebagai marker. |
| **Uji GPS** | Aplikasi meminta izin lokasi, membaca posisi user, dan menangani kondisi GPS mati. |
| **Uji Routing In-App** | Polyline rute berhasil digambar di peta menggunakan data dari OSRM API. |
| **Uji Routing Fallback** | Tombol "Buka di Google Maps" membuka navigasi di Google Maps eksternal. |
| **Uji Koneksi** | Pesan jelas muncul saat server down, internet mati, atau response kosong. |
| **Demo Akhir** | Dari HP/emulator: buka app → izinkan GPS → cari/pilih bengkel → lihat detail → jalankan rute. |

---

## 12. Ruang Lingkup

### Fitur Wajib (Core / MVP)
- Direktori bengkel (list + detail).
- Map & Marker dari data server.
- GPS & Rute in-app (OSRM Polyline) dari lokasi pengguna.

### Fitur Tambahan *(Nice to have)*
- Pencarian & Filter (kategori, kata kunci).
- Admin Dashboard mobile *(sudah diimplementasikan — melebihi minimum berupa halaman web sederhana)*.
- Favorit / Review (rating dan komentar) — opsional.

> **Saran:** Batasi penambahan fitur kosmetik sampai integrasi cloud (app + API + database + GPS) berjalan stabil.

---

## 13. Rencana Pengerjaan

| Minggu | Kegiatan |
|---|---|
| Minggu 1 | Definisi domain, fitur, data tempat, dan rancangan database. |
| Minggu 2 | Konfigurasi Supabase API dan uji endpoint (Postman/browser). |
| Minggu 3–4 | Bangun UI Android: list, detail, peta, dan marker. |
| Minggu 5–6 | Integrasi GPS, routing OSRM, error handling, dan deployment. |
| Minggu 7 | Testing, dokumentasi, video/demo, dan presentasi akhir. |

> Setiap minggu menghasilkan artefak: skema, API, app screen, integrasi, dan demo.

---

## 14. Output Akhir & Bobot Penilaian

| Bobot | Komponen | Kriteria |
|---|---|---|
| **35%** | Aplikasi Android | UI berjalan, peta tampil, marker muncul, detail jelas, rute dapat dibuka. |
| **25%** | Backend, API, & Cloud | Server online, endpoint rapi, response JSON benar, error ditangani. |
| **15%** | Database & Data | Skema sesuai, koordinat valid, data cukup, kategori jelas. |
| **15%** | Dokumentasi & Demo | Presentasi, diagram arsitektur, bukti testing, video/screenshot demo. |
| **10%** | Dokumen HKI | Dokumen yang diperlukan untuk pendaftaran HKI. |

> **Kesimpulan:** Proyek berhasil bila aplikasi mobile, API, database, server cloud, dan GPS dapat bekerja sebagai satu sistem.
