# Riwayat Rilis WA-Bot (WA Gateway)

Dokumen ini mencatat semua perubahan dan peningkatan signifikan di setiap versi WA-Bot.

---

## v4.0.0 — Edisi UI/UX Refactor & Dashboard Lengkap
**Dirilis pada: 2 Juni 2026**

Rilis besar yang memperkenalkan **design system baru** secara menyeluruh dan **mengaktifkan seluruh menu dashboard** yang sebelumnya masih Coming Soon. Tidak ada perubahan pada backend, model, auth, atau CSRF.

### 🎨 UI/UX Refactor Total (Phase 1)

**Design System & Stack Frontend Baru**
- Migrasi ke Tailwind CSS + DaisyUI 4.x + Alpine.js 3.x di semua halaman utama
- Font Inter + Lucide Icons sebagai standard visual
- Brand name "WA-Bot" konsisten di seluruh halaman
- Semua halaman responsive desktop (1280px) dan mobile (375px)

**Partial System Modular (~20 partial)**
- `core/` — head, scripts, flash-alert, page-header, empty-state, confirm-modal
- `nav/` — topbar-public, topbar-app, sidebar-user (terpisah), sidebar-admin (terpisah)
- `landing/` — hero, feature-grid, security-section, use-case-section, cta-footer
- `dashboard-user/` — kpi-cards, device-table, recent-activity, quick-actions
- `dashboard-admin/` — kpi-cards, system-health, recent-users, audit-feed, admin-actions
- `terms/` — hero, toc, sections

**Halaman yang Direfactor**
- **Landing Page** — hero kuat, 6 fitur utama, trust/security section, use-case, CTA Contact Sales, tanpa pricing publik
- **Login Page** — password toggle (Alpine.js), loading state tombol submit, flash message rapi
- **Terms Page** — TOC dengan anchor navigation, typography readable, effective date
- **User Dashboard** — KPI personal (device aktif, messages, failed, uptime), device table, recent activity, quick actions
- **Admin Dashboard** — KPI global, system health panel, recent users, audit feed, admin quick actions
- **User Management** — tabel user, role badge, status badge, confirm modal per aksi

### 🔗 Missing Routes — 10 Endpoint Baru

**User Pages** (`controllers/userPages.controller.js`)
- `GET /users/devices` — daftar device personal + connect/disconnect/delete action
- `GET /users/messages` — riwayat pesan keluar, filter status, pagination 20/hal
- `GET /users/activity` — feed 50 aktivitas terbaru (incoming + outgoing)
- `GET /users/profile` — info akun, edit nama & email
- `POST /users/profile` — update profil + ganti password (validasi password lama + CSRF)

**Admin Pages** (`controllers/adminPages.controller.js`)
- `GET /admin/devices` — semua device semua user, filter status & user, toggle media, pagination 20/hal
- `GET /admin/logs` — system-wide logs (incoming + outgoing), filter tipe & status, 50 entri
- `GET /admin/settings` — konfigurasi platform dari model Setting, grouped by kategori
- `POST /admin/settings` — simpan pengaturan via upsert + CSRF

**Sidebar Activation**
- Semua menu yang sebelumnya `opacity-40 pointer-events-none` + badge "Soon" kini menjadi link aktif
- `sidebar-user.ejs` — 5 menu aktif: Dashboard, My Devices, Messages, Activity, Profil
- `sidebar-admin.ejs` — 6 menu aktif: Admin Dashboard, Devices (All), Users, Logs, Settings

### ✅ Tidak Ada Breaking Changes
- Route, controller, model, auth, session, dan CSRF existing tidak diubah
- Semua form POST tetap menggunakan hidden CSRF token
- Socket.IO untuk QR code WhatsApp tetap di `scripts.ejs`

---

## v3.9 — Edisi Keamanan & Hardening
**Dirilis pada: 22 April 2026**

Fokus pada **security hardening menyeluruh** berdasarkan PRD Security v1.0.0, v1.1.0, dan v1.2.0. Semua celah keamanan V-01 hingga V-14 ditutup.

- **Anti Timing Attack**: Validasi API key menggunakan `crypto.timingSafeEqual()`
- **Anti Enumeration**: Semua kegagalan autentikasi mengembalikan HTTP `401` generik
- **SSRF Protection**: DNS re-validation + blocking semua private IP range
- **HTTPS-Only Webhook**: URL `http://` ditolak saat penyimpanan settings
- **HMAC Signature**: Header `X-WA-Signature` (SHA256) untuk verifikasi webhook
- **Axios Hardening**: Timeout 5s, batas ukuran response/request, redirect off
- **Payload Limit**: Global 2MB, khusus `/webhook/wabot` 64KB
- **File Ownership Check**: User hanya bisa akses file miliknya di `/uploads/` dan `/temp/`
- **Rate Limiting Settings**: 20 request per 15 menit di endpoint settings
- **Auto Cleanup Temp**: Dibersihkan otomatis setiap 6 jam dan saat startup
- **Audit Log Webhook**: Setiap perubahan webhook URL dicatat (user, domain, IP, timestamp)
- **Input Sanitization**: Nama akun dibersihkan dari karakter HTML/JS (anti stored XSS)

---

## v3.8 — Edisi Ketangguhan Infrastruktur
**Dirilis pada: 6 Februari 2026**

- **Database Readiness Guard**: Aplikasi menunggu koneksi PostgreSQL stabil sebelum memulai layanan WhatsApp
- **Anti Ghost Session**: Status sesi dimuat benar hanya setelah database terhubung
- **Auto-Recovery Logic**: Koneksi database terputus akan disambung ulang otomatis

---

## v3.7 — Edisi Fondasi Publikasi Lanjutan
**Dirilis pada: 16 Oktober 2025**

- **Alur Terms & Conditions**: Wajib disetujui pengguna baru sebelum akses dashboard
- **Landing Page**: Halaman depan sebagai wajah layanan
- **Peningkatan Navigasi**: Link antar halaman login, dashboard, dan landing page

---

## v3.6 — Edisi Skalabilitas & Kontrol Admin
**Dirilis pada: 15 Oktober 2025**

- **Migrasi ke PostgreSQL**: Mengganti SQLite untuk skalabilitas multi-user
- **Modal Konfirmasi Admin**: Saat hapus sesi pengguna
- **Perbaikan Filter Admin**: Filter user dan status di panel admin

---

## v3.5 — Edisi Multi-Pengguna & Kontrol Admin
**Dirilis pada: 14 Oktober 2025**

- **Sistem Multi-Pengguna & Peran**: Role `admin` dan `user` via Google OAuth
- **Batas Sesi per Pengguna**: Configurable via panel admin
- **Panel Admin Terpusat**: Monitoring semua sesi, toggle media, edit limit, hapus sesi
- **Session ID Kustom**: Format `YYMMXXXX` menggantikan accountId numerik
- **API Cerdas**: `/send-media` mematuhi setting `allowMedia` per sesi

---

## v3.4 — Edisi Stabilitas Koneksi
**Dirilis pada: 13 Oktober 2025**

- **Perbaikan koneksi kritis**: Mengatasi error `statusCode: 405` dan `515`
- **Stabilisasi server**: Konfigurasi nodemon untuk abaikan perubahan non-kode

---

## v3.3 — Edisi Peningkatan Sesi
**Dirilis pada: 11 Oktober 2025**

- **Session ID**: Memperkenalkan sessionId kustom untuk API
- **Logika pemulihan sesi**: Koneksi ulang otomatis yang lebih stabil
- **Peningkatan keamanan API**: Validasi `allowMedia` di semua endpoint media

---

## v3.2 — Edisi Upload Media Fleksibel
**Dirilis pada: 9 Oktober 2025**

- **Upload multipart fleksibel**: Field name dinamis di `/api/send-media`
- **Perbaikan buffer media**: Pengolahan buffer saat simpan ke database

---

## v3.1 — Edisi Keamanan & Stabilitas
**Dirilis pada: 6 Oktober 2025**

- **Enkripsi AES-256**: apiKey dan webhookUrl dienkripsi di database
- **Rate Limiting API**: Proteksi dari DoS
- **Antrian Pesan Keluar**: Sistem queue anti-blokir

---

## v3.0 — Edisi Dashboard Interaktif
**Dirilis pada: 4 Oktober 2025**

- **WebSocket realtime**: Status koneksi, QR code, dan pesan baru real-time
- **Log Pesan di Dashboard**: Riwayat pesan masuk dan keluar
- **Konfigurasi per Sesi**: Webhook URL dan API Key unik per sesi

---

## v2.0 — Edisi Media & API Fleksibel
**Dirilis pada: 3 Oktober 2025**

- **Penanganan Media Masuk**: Terima pesan media dan kirim URL via webhook
- **API Pengiriman Media**: Endpoint `/api/send` dan `/api/send-media`

---

## v1.0 — Rilis Fondasi Awal
**Dirilis pada: 2 Oktober 2025**

- **Multi-Akun**: Tambah dan hubungkan beberapa akun WhatsApp
- **Dashboard Sederhana**: Monitor status koneksi dan QR code
- **Webhook Pesan Masuk**: Notifikasi pesan teks ke webhook global
- **Login Aman**: Google OAuth 2.0
