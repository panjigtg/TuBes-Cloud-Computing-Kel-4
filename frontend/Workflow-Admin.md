# Workflow Admin
## App Map Directory Bengkel

---

## Gambaran Umum

Admin adalah pengelola direktori bengkel. Admin bisa login, menambah data bengkel baru (termasuk upload foto), melihat daftar bengkel, mengedit data, dan menghapus bengkel. Semua aksi admin membutuhkan autentikasi via Supabase Auth.

---

## Alur Lengkap

```
Tap Tombol Admin 🛡 di Home
    │
    ▼
[1] Layar Login Admin
    │
    ├── Input tidak lengkap ──► Banner error "Email dan password harus diisi"
    │
    ├── Kredensial salah ──► Banner error "Email atau password salah"
    │
    └── Login berhasil
          │
          ▼
[2] Dashboard Admin
    │
    ├── [Tab 1] Tambah Bengkel Baru
    │       │
    │       ├── Tap area foto ──► [3] Image Picker (galeri HP)
    │       │       │
    │       │       └── Pilih foto ──► Compress JPEG ──► Preview di form
    │       │
    │       ├── Isi form (nama, kategori, deskripsi, lat, lng)
    │       │
    │       ├── Validasi gagal ──► Alert error field yang kosong/salah
    │       │
    │       └── Tap "Simpan Bengkel"
    │               │
    │               ├── Upload foto ke Supabase Storage
    │               ├── Dapat public URL foto
    │               ├── Insert data ke tabel `places`
    │               └── Berhasil ──► Alert sukses ──► Reset form ──► Refresh daftar
    │
    ├── [Tab 2] Daftar Bengkel
    │       │
    │       ├── Tap kartu bengkel ──► [4] Detail Bengkel (Admin View)
    │       │       │
    │       │       ├── Tap "Edit" ──► [5] Edit Bengkel
    │       │       │       │
    │       │       │       ├── Ubah data / ganti foto
    │       │       │       ├── Tap "Simpan Perubahan" ──► Update di Supabase ──► Kembali ke Daftar
    │       │       │       └── Tap "Batal" ──► Konfirmasi ──► Kembali ke Daftar
    │       │       │
    │       │       └── Tap "Hapus" ──► [6] Konfirmasi Hapus ──► Delete ──► Kembali ke Daftar
    │       │
    │       └── Tap ikon hapus langsung di kartu ──► [6] Konfirmasi Hapus
    │
    └── Tap Logout ──► Sign out Supabase ──► Kembali ke Home
```

---

## Detail Setiap Langkah

### [1] Login Admin

**Layar:** Login Screen

**Elemen:**
- Logo shield coral di tengah atas
- Judul "Admin Panel"
- Subtitle "Masuk untuk mengelola direktori bengkel"
- Field Email (dengan ikon `email-outline`)
- Field Password (dengan ikon `lock-outline` + toggle show/hide)
- Tombol **"Masuk"** (coral/merah)
- Tombol back (kiri atas) → kembali ke Home

**Validasi sebelum submit:**
- Email tidak boleh kosong
- Password tidak boleh kosong
- Jika kosong → banner error merah: "Email dan password harus diisi"

**Proses login:**
1. Tap "Masuk"
2. Tombol berubah jadi spinner (loading state)
3. Panggil `supabase.auth.signInWithPassword({ email, password })`
4. Jika gagal → banner error: "Email atau password salah"
5. Jika berhasil → `navigation.replace('AdminDashboard')`

**Kredensial demo:**
- Email: (email admin yang terdaftar di Supabase)
- Password: `admin123`

---

### [2] Dashboard Admin

**Layar:** Admin Dashboard

**Header:**
- Tombol back (kiri) → kembali ke Home
- Judul "Dashboard Admin"
- Tombol logout (kanan, ikon merah) → sign out + kembali ke Home

**Tab Switcher:**
- Tab 1: **"Tambah Baru"** (ikon `plus-circle`)
- Tab 2: **"Daftar (N)"** — N = jumlah bengkel saat ini

---

### [3] Tambah Bengkel Baru (Tab 1)

**Layar:** Dashboard Admin — Tab Tambah Baru

**Form fields (semua dalam ScrollView):**

#### Upload Foto
- Area dashed border teal, tinggi 200px
- Default: ikon kamera + teks "Pilih Foto Bengkel"
- Setelah pilih: preview foto full-cover
- Tap area → buka `expo-image-picker` (galeri)
- Setelah pilih foto:
  1. `expo-image-manipulator` resize ke lebar max 800px
  2. Compress ke JPEG quality 0.7
  3. Tampilkan preview di form

#### Nama Bengkel *
- Input teks, ikon `store`
- Wajib diisi
- Contoh: "Bengkel Jaya Motor"

#### Kategori *
- Grid chip kategori (wrap)
- Wajib dipilih satu
- Chip terpilih: border + background warna kategori
- Pilihan: Bengkel Mobil, Bengkel Motor, Tambal Ban, Bengkel Resmi, Bengkel Umum

#### Deskripsi / Layanan
- Textarea multiline (opsional)
- Contoh: "Servis berkala, tune up, ganti oli, perbaikan mesin"

#### Pilih Lokasi di Peta *
- **Bukan input teks manual** — admin memilih lokasi dengan tap langsung di peta
- Tampilan: tombol **"Pilih Lokasi di Peta"** (teal, ikon `map-marker-plus`)
- Jika lokasi sudah dipilih: tampilkan preview peta kecil (tinggi 160px) dengan marker di titik yang dipilih + teks koordinat di bawahnya (format monospace, read-only)
- Tap tombol / tap preview peta → buka **[3a] Layar Pilih Lokasi**

#### Tombol "Simpan Bengkel"
- Background hijau (`#34D399`), ikon `content-save`
- Saat loading: spinner, tombol disabled

---

### [3a] Layar Pilih Lokasi di Peta

**Layar:** Full-screen map picker — muncul di atas form (modal atau screen baru)

**Tujuan:** Admin tap di peta untuk menentukan koordinat bengkel. Tidak perlu tahu nilai lat/lng — cukup tap titik yang tepat.

**Layout:**

```
┌─────────────────────────────────┐
│ ✕  Pilih Lokasi Bengkel         │  ← Header: tombol tutup (kiri) + judul
├─────────────────────────────────┤
│                                 │
│                                 │
│   [PETA FULL SCREEN]            │  ← Google Maps, bisa di-scroll/zoom
│                                 │    Awal: zoom ke posisi GPS admin
│         📍 (marker draggable)   │    Marker muncul di tengah saat pertama
│                                 │    Admin bisa drag marker ke lokasi
│                                 │    ATAU tap di titik manapun di peta
│                                 │
│                                 │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │  ← Info panel bawah (fixed)
│ │  📍  -6.208763, 106.845599  │ │    koordinat update real-time saat
│ │      (monospace, teal)      │ │    marker digeser/dipindah
│ │                             │ │
│ │  [Gunakan Lokasi Ini]       │ │  ← Tombol konfirmasi (teal, full width)
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Cara kerja:**
1. Layar dibuka → peta zoom ke posisi GPS admin saat ini
2. Marker draggable muncul di tengah peta
3. Admin bisa:
   - **Drag marker** ke lokasi bengkel, atau
   - **Tap di titik manapun** di peta → marker pindah ke titik tersebut
4. Koordinat di panel bawah update real-time mengikuti posisi marker
5. Tap **"Gunakan Lokasi Ini"** → koordinat disimpan → kembali ke form
6. Tap **✕** → batal, kembali ke form tanpa menyimpan koordinat

**Tombol tambahan (floating di peta):**
- **Tombol "Lokasi Saya"** (kanan atas, ikon `crosshairs-gps`) → pindahkan marker ke posisi GPS admin saat ini (berguna jika admin sedang berada di lokasi bengkel)

**Setelah kembali ke form:**
- Tombol "Pilih Lokasi di Peta" berubah menjadi preview peta kecil (160px) dengan marker di titik yang dipilih
- Di bawah preview: teks koordinat read-only (monospace, abu)
- Ada tombol kecil **"Ubah Lokasi"** di pojok kanan atas preview → buka kembali layar pilih lokasi

**Proses simpan:**
```
Tap "Simpan Bengkel"
    │
    ├── Validasi:
    │   ├── Nama kosong? → Alert "Nama bengkel harus diisi"
    │   ├── Kategori belum dipilih? → Alert "Pilih kategori bengkel"
    │   └── Lokasi belum dipilih? → Alert "Pilih lokasi bengkel di peta"
    │
    └── Validasi lolos:
        │
        ├── [Jika ada foto]
        │   ├── fetch(imageUri) → blob → ArrayBuffer
        │   ├── supabase.storage.from('bengkel-photos').upload(fileName, arrayBuffer)
        │   └── supabase.storage.from('bengkel-photos').getPublicUrl(fileName) → photoUrl
        │
        └── supabase.from('places').insert({
                name, description, category_id,
                latitude, longitude, photo_url
            })
            │
            ├── Error → Alert "Gagal menyimpan data: [pesan error]"
            └── Sukses → Alert "Bengkel baru berhasil ditambahkan!"
                       → Reset semua field
                       → Refresh daftar bengkel
```

---

### [4] Daftar Bengkel (Tab 2)

**Layar:** Dashboard Admin — Tab Daftar

**Yang ditampilkan:**
- FlatList semua bengkel, diurutkan dari terbaru (`created_at` descending)
- Per kartu: foto thumbnail (50×50px) + nama + kategori + koordinat (monospace)
- Tombol aksi per kartu:
  - Ikon `pencil` teal → Edit
  - Ikon `trash-can` merah → Hapus

**Empty state:** Ikon `store-off` + teks "Belum ada bengkel"

**Data di-fetch dari:**
```
supabase.from('places')
  .select('*, categories(name, icon_name)')
  .order('created_at', { ascending: false })
```

---

### [5] Detail Bengkel — Admin View *(perlu ditambahkan)*

**Layar:** Admin Detail Bengkel

**Trigger:** Tap kartu bengkel di Tab Daftar

**Yang ditampilkan:**
- Foto hero (250px)
- Badge "Admin View" (kanan atas, amber)
- Nama bengkel (28px bold)
- Badge kategori
- Info grid 2 kolom: Latitude, Longitude, Tanggal ditambahkan
- Deskripsi (jika ada)
- URL foto (monospace, truncated)

**Tombol (fixed bottom bar, 2 sejajar):**
- **"Edit"** (teal) → navigasi ke Edit Bengkel
- **"Hapus"** (merah) → konfirmasi hapus

---

### [6] Konfirmasi Hapus

**Trigger:** Tap ikon hapus di kartu daftar ATAU tap "Hapus" di Detail Admin

**Yang terjadi:**
- `Alert.alert` muncul dengan judul "Hapus Bengkel"
- Pesan: "Yakin ingin menghapus bengkel ini?"
- Dua tombol:
  - **"Batal"** → tutup alert, tidak ada perubahan
  - **"Hapus"** (destructive, merah) → proses hapus

**Proses hapus:**
```
Tap "Hapus" di Alert
    │
    └── supabase.from('places').delete().eq('id', placeId)
        │
        ├── Error → Alert "Gagal menghapus: [pesan error]"
        └── Sukses → Refresh daftar bengkel
```

---

### [7] Edit Bengkel *(perlu ditambahkan)*

**Layar:** Edit Bengkel

**Trigger:** Tap ikon edit di kartu daftar ATAU tap "Edit" di Detail Admin

**Form:** Sama dengan form Tambah Baru, tapi semua field sudah terisi dengan data bengkel yang dipilih.

**Pre-filled data:**
- Foto: tampilkan foto existing (tap untuk ganti)
- Nama: `place.name`
- Kategori: `place.category_id` sudah terpilih
- Deskripsi: `place.description`
- Lokasi: preview peta kecil dengan marker di `place.latitude`, `place.longitude` + koordinat read-only. Tap preview → buka layar pilih lokasi dengan marker sudah di posisi lama

**Header:**
- Tombol "Batal" (kiri) → konfirmasi → kembali
- Judul "Edit Bengkel"
- Tombol "Simpan" (kanan, teal text)

**Proses simpan:**
```
Tap "Simpan Perubahan"
    │
    ├── Validasi (sama seperti Tambah Baru)
    │
    └── Validasi lolos:
        │
        ├── [Jika foto DIGANTI]
        │   ├── Upload foto baru ke Supabase Storage
        │   └── Dapat URL baru
        │
        ├── [Jika foto TIDAK diganti]
        │   └── Gunakan place.photo_url yang lama
        │
        └── supabase.from('places').update({
                name, description, category_id,
                latitude, longitude, photo_url
            }).eq('id', place.id)
            │
            ├── Error → Alert pesan error
            └── Sukses → Alert "Perubahan berhasil disimpan"
                       → navigation.goBack()
```

**Tombol "Batal":**
```
Tap "Batal"
    │
    └── Alert.alert "Batalkan perubahan?"
        ├── "Lanjut Edit" → tutup alert
        └── "Batalkan" → navigation.goBack() tanpa simpan
```

---

### [8] Logout

**Trigger:** Tap ikon logout di header Dashboard

**Yang terjadi:**
1. `supabase.auth.signOut()`
2. `navigation.replace('Home')`
3. User kembali ke Home sebagai pengguna biasa

---

## Ringkasan Tombol & Aksi

| Tombol / Elemen | Lokasi | Aksi |
|---|---|---|
| Tombol "Masuk" | Login | Autentikasi via Supabase Auth |
| Tombol back | Login | Kembali ke Home |
| Tab "Tambah Baru" | Dashboard | Tampilkan form tambah |
| Tab "Daftar (N)" | Dashboard | Tampilkan daftar bengkel |
| Area foto | Form Tambah / Edit | Buka image picker galeri |
| Chip kategori | Form Tambah / Edit | Pilih kategori bengkel |
| Tombol "Pilih Lokasi di Peta" | Form Tambah / Edit | Buka layar map picker |
| Drag marker / tap peta | Layar Pilih Lokasi | Set koordinat bengkel |
| Tombol "Lokasi Saya" | Layar Pilih Lokasi | Pindah marker ke posisi GPS admin |
| Tombol "Gunakan Lokasi Ini" | Layar Pilih Lokasi | Simpan koordinat → kembali ke form |
| Tombol ✕ | Layar Pilih Lokasi | Batal → kembali ke form tanpa simpan |
| Tombol "Ubah Lokasi" | Preview peta di form | Buka kembali layar pilih lokasi |
| Tombol "Simpan Perubahan" | Form Edit | Update data di Supabase |
| Tombol "Batal" | Form Edit | Konfirmasi → kembali tanpa simpan |
| Ikon `pencil` | Kartu daftar | Navigasi ke Edit Bengkel |
| Ikon `trash-can` | Kartu daftar | Konfirmasi hapus |
| Tombol "Edit" | Detail Admin | Navigasi ke Edit Bengkel |
| Tombol "Hapus" | Detail Admin | Konfirmasi hapus |
| Tombol "Hapus" di Alert | Konfirmasi hapus | Delete dari Supabase |
| Tombol "Batal" di Alert | Konfirmasi hapus | Tutup alert |
| Tombol logout | Header Dashboard | Sign out + kembali ke Home |

---

## Validasi Form

| Field | Aturan | Pesan Error |
|---|---|---|
| Nama Bengkel | Tidak boleh kosong | "Nama bengkel harus diisi" |
| Kategori | Wajib pilih satu | "Pilih kategori bengkel" |
| Lokasi | Wajib dipilih via peta | "Pilih lokasi bengkel di peta" |
| Foto | Opsional | — |
| Deskripsi | Opsional | — |

---

## Error States

| Kondisi | Yang Ditampilkan |
|---|---|
| Login gagal (kredensial salah) | Banner merah: "Email atau password salah" |
| Field kosong saat login | Banner merah: "Email dan password harus diisi" |
| Upload foto gagal | Alert: "Gagal mengunggah foto: [pesan]" |
| Insert data gagal | Alert: "Gagal menyimpan data: [pesan]" |
| Update data gagal | Alert: pesan error dari Supabase |
| Hapus data gagal | Alert: "Gagal menghapus: [pesan]" |
| Daftar bengkel kosong | Empty state: ikon + "Belum ada bengkel" |
| Tidak ada internet | Operasi gagal + pesan error |

---

## Catatan Teknis

- **Koordinat dari map picker:** Nilai `latitude` dan `longitude` diambil dari event `onPress` MapView (`event.nativeEvent.coordinate`) atau dari posisi marker draggable (`onDragEnd`). Tidak ada input manual — koordinat selalu valid angka.
- **Autentikasi:** Supabase Auth — session disimpan di `AsyncStorage` via `@react-native-async-storage/async-storage`. Session otomatis di-refresh (`autoRefreshToken: true`).
- **Upload foto:** File dikonversi ke `ArrayBuffer` sebelum upload ke Supabase Storage. Format: JPEG. Nama file: `bengkel_[timestamp].jpg`.
- **Bucket Storage:** `bengkel-photos` — harus sudah dibuat di Supabase dashboard dengan akses public.
- **Row Level Security (RLS):** Operasi insert/update/delete di tabel `places` harus diizinkan untuk user yang sudah login (authenticated role) di Supabase RLS policy.
- **Foto lama saat edit:** Jika admin tidak mengganti foto, `photo_url` lama tetap digunakan. File lama di Storage tidak dihapus otomatis (perlu cleanup manual jika diperlukan).
