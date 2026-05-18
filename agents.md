# Project Overview

## Project Name

Direktori Bengkel / Android Map Directory

## Purpose

A mobile directory app to find, view, and manage bengkel locations using a map and list interface.

## Scope

- React Native mobile app built with Expo
- Free Firebase backend using Spark Plan
- Map integration using `react-native-maps` with OpenStreetMap-style sources
- Features:
  - Directory list of bengkel locations
  - Map view with nearby markers
  - Bengkel detail screen
  - Add / edit bengkel entries
  - Optional authentication for data management

## Chosen Stack

- `React Native` + `Expo`
- `Firebase Spark Plan`
  - `Firestore` for bengkel data
  - `Firebase Auth` for login
  - `Firebase Storage` for bengkel photos
- `react-native-maps` for map display
- Open-source map tiles / OpenStreetMap to avoid Google Maps billing
- JavaScript by default; TypeScript optional if the team wants stronger typing

## Application Concept

### User Story

Pengguna ingin menemukan bengkel terdekat dengan mudah melalui peta atau daftar, lihat detail lokasi, jam kerja, contact, dan foto bengkel. Pengguna bisa juga menambahkan atau mengedit data bengkel mereka sendiri.

### App Flow

1. **Login Screen** (optional)
   - Firebase Auth dengan email/password
   - Atau akses sebagai anonymous user

2. **Home Screen** (Tab: List View & Map View)
   - **List View**: daftar bengkel dengan nama, rating, jarak, foto
   - **Map View**: peta dengan marker bengkel di sekitar lokasi pengguna

3. **Bengkel Detail Screen**
   - Nama, alamat, nomor telepon, jam kerja, rating
   - Foto bengkel dari Firebase Storage
   - Tombol: Call, Get Directions, Edit, Delete

4. **Add / Edit Bengkel Screen**
   - Form: nama, alamat, nomor, jam kerja
   - Upload foto
   - Pilih lokasi di peta atau input koordinat
   - Simpan ke Firestore

5. **Profile Screen** (optional)
   - Data user yang login
   - Daftar bengkel yang ditambahkan user

### Data Model (Firestore)

```
bengkels/ (collection)
  ├─ id
  │  ├─ nama: string
  │  ├─ alamat: string
  │  ├─ latitude: number
  │  ├─ longitude: number
  │  ├─ nomor: string
  │  ├─ jamBuka: string (HH:mm)
  │  ├─ jamTutup: string (HH:mm)
  │  ├─ foto: string (Firebase Storage URL)
  │  ├─ rating: number
  │  ├─ uploadedBy: string (user UID)
  │  └─ createdAt: timestamp

users/ (collection)
  ├─ uid
  │  ├─ email: string
  │  ├─ nama: string
  │  └─ createdAt: timestamp
```

## Use Cases (MVP Phase 1)

### UC-1: View Bengkel List

**Actor**: User
**Flow**:

1. User membuka app dan masuk Home Screen
2. Tab List View aktif secara default
3. App fetch semua bengkel dari Firestore
4. Tampilkan dalam list dengan nama, foto, jarak, rating
5. User bisa scroll dan tap untuk lihat detail

### UC-2: View Bengkel Map

**Actor**: User
**Flow**:

1. User membuka app dan tap tab Map View
2. App request lokasi pengguna (geolocation)
3. Render peta dengan marker bengkel
4. User bisa tap marker untuk lihat popup atau detail
5. User bisa zoom/pan peta

### UC-3: View Bengkel Detail

**Actor**: User
**Flow**:

1. User tap item di List atau marker di Map
2. Navigate ke Detail Screen
3. Tampilkan: nama, alamat, nomor, jam kerja, foto, rating
4. Buttons: Call (intent ke Phone), Get Directions (intent ke Maps)
5. Jika user adalah pembuat: show Edit & Delete buttons

### UC-4: Add Bengkel (Authenticated User)

**Actor**: Authenticated User
**Flow**:

1. User tap "Add Bengkel" button di Home Screen
2. Navigate ke Add/Edit Form
3. User input: nama, alamat, nomor, jam buka, jam tutup
4. User pilih lokasi di peta atau input koordinat manual
5. User upload foto (Firebase Storage)
6. User tap Save
7. App validate input dan simpan ke Firestore
8. Navigate kembali ke Home Screen
9. Tunggu sync dan tampilkan bengkel baru di list/map

### UC-5: Edit Bengkel (Owner Only)

**Actor**: Authenticated User (Bengkel Owner)
**Flow**:

1. User tap Detail Bengkel yang dia buat
2. Tap Edit button
3. Form pre-filled dengan data bengkel
4. User ubah data sesuai kebutuhan
5. User tap Save
6. App update di Firestore
7. Navigate kembali ke Detail Screen dengan data terbaru

### UC-6: Delete Bengkel (Owner Only)

**Actor**: Authenticated User (Bengkel Owner)
**Flow**:

1. User tap Detail Bengkel yang dia buat
2. Tap Delete button
3. Show confirmation dialog
4. User confirm
5. App delete document dari Firestore dan foto dari Storage
6. Navigate kembali ke Home Screen

### UC-7: Login

**Actor**: User
**Flow**:

1. User masuk app untuk pertama kali atau tidak ada session
2. Redirect ke Login Screen
3. User input email dan password
4. Firebase Auth validate credentials
5. Jika sukses: login user dan simpan session
6. Navigate ke Home Screen

## Clean Architecture Structure

Use one main app repository with a clean architecture layout rather than separate `frontend/` and `backend/` folders, because the backend is Firebase-managed.

Recommended folder tree:

- `assets/`
- `src/`
  - `presentation/`
    - `screens/`
    - `components/`
  - `domain/`
    - `models/`
    - `usecases/`
  - `data/`
    - `repositories/`
    - `datasources/`
  - `core/`
    - `config/`
    - `constants/`
  - `navigation/`
  - `services/`
    - `firebaseAuth.js`
    - `firestoreService.js`
    - `storageService.js`
  - `hooks/`
  - `contexts/`
  - `utils/`
  - `types/` (optional)
- `App.js` or `App.tsx`
- `app.json` or `app.config.js`
- `package.json`
- `README.md`

## Notes

- Keep GitHub workflows optional for now; they are useful for CI/test automation but not required for the first functional prototype.
- The free approach is Expo + Firebase Spark + OpenStreetMap.
- If the project later needs a custom backend, add a `backend/` folder or Firebase Cloud Functions separately.
