# WA-Bot — WhatsApp Gateway Platform

> **Versi 4.0.0** — Edisi UI/UX Refactor & Dashboard Lengkap

WA-Bot adalah platform WhatsApp Gateway multi-sesi yang dibangun di atas Node.js + Baileys. Mendukung multi-device, role-based access (admin/user), autentikasi via Google OAuth, dan integrasi webhook untuk otomasi seperti n8n.

Versi 4.0 adalah rilis besar yang memperkenalkan **design system baru** (Tailwind CSS + DaisyUI + Alpine.js), **partial system modular**, dan **aktivasi penuh seluruh menu dashboard** yang sebelumnya masih Coming Soon.

---

## ✨ Yang Baru di v4.0.0

### 🎨 UI/UX Refactor Total (Phase 1)
- **Design system baru** — Tailwind CSS + DaisyUI 4.x + Alpine.js 3.x di semua halaman
- **Landing page** baru dengan hero, fitur, trust/security section, use-case, dan CTA Contact Sales
- **Login page** dengan password toggle dan loading state
- **Terms page** dengan TOC, anchor navigation, dan typography yang nyaman dibaca
- **User dashboard** — panel operasional personal dengan KPI, device table, activity, quick actions
- **Admin dashboard** — control center global dengan system health, audit feed, dan admin actions
- **User management** — tabel user dengan role/status badge dan confirm modal
- **Partial system modular** — ~20 partial reusable (core, nav, landing, dashboard-user, dashboard-admin, terms)
- Sidebar user dan admin dipisahkan secara eksplisit
- Seluruh halaman responsive desktop (1280px) dan mobile (375px)

### 🔗 Missing Routes — Semua Menu Aktif
- `/users/devices` — My Devices: daftar device personal + connect/disconnect/delete
- `/users/messages` — Messages: riwayat pesan keluar + filter status + pagination
- `/users/activity` — Activity: feed chronological pesan masuk & keluar
- `/users/profile` — Profile: edit nama, email, dan ganti password
- `/admin/devices` — All Devices: monitoring device semua user + filter + toggle media
- `/admin/logs` — System Logs: log aktivitas global + filter tipe & status
- `/admin/settings` — Platform Settings: konfigurasi sistem via UI, grouped per kategori

---

## 🔐 Fitur Keamanan (Dipertahankan dari v3.9)

- **Constant-Time API Key Comparison** — anti timing attack
- **Anti-Enumeration** — semua auth failure selalu `401` generik
- **SSRF Protection** — DNS re-validation + private IP blocking
- **HTTPS-Only Webhook** + HMAC Signature
- **Axios Hardening** — timeout, ukuran response/request, redirect off
- **File Ownership Validation** — user hanya bisa akses file miliknya
- **Rate Limiting** — endpoint sensitif dibatasi 20 req/15 menit
- **Auto Cleanup Temp Files** — setiap 6 jam + saat startup
- **CSRF Protection** — semua form POST menggunakan hidden CSRF token
- **Input Sanitization** — mencegah stored XSS

---

## 🏗️ Arsitektur Frontend

```
views/
├── landing-page.ejs
├── login.ejs
├── terms.ejs
├── dashboard.ejs          ← user dashboard
├── admin-dashboard.ejs    ← admin control center
├── user-management.ejs
├── user-devices.ejs
├── user-messages.ejs
├── user-activity.ejs
├── user-profile.ejs
├── admin-devices.ejs
├── admin-logs.ejs
├── admin-settings.ejs
└── partials/
    ├── core/          → head, scripts, flash-alert, page-header, empty-state, confirm-modal
    ├── nav/           → topbar-public, topbar-app, sidebar-user, sidebar-admin
    ├── landing/       → hero, feature-grid, security-section, use-case-section, cta-footer
    ├── dashboard-user/  → kpi-cards, device-table, recent-activity, quick-actions
    ├── dashboard-admin/ → kpi-cards, system-health, recent-users, audit-feed, admin-actions
    └── terms/         → hero, toc, sections
```

---

## ⚠️ Disclaimer
**Proyek ini bukan API resmi WhatsApp.**

Aplikasi ini menggunakan WhatsApp Web automation (Baileys). Penggunaan untuk spam atau pelanggaran kebijakan dapat menyebabkan nomor diblokir permanen. Gunakan dengan bijak.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Runtime | Node.js |
| Framework | Express.js 4.18 |
| Template | EJS 3.1 |
| CSS | Tailwind CSS + DaisyUI 4.x (CDN) |
| JS Interactivity | Alpine.js 3.x (CDN) |
| Icons | Lucide Icons (CDN) |
| Font | Inter (Google Fonts) |
| WhatsApp | Baileys (@whiskeysockets) |
| Database | PostgreSQL + Sequelize |
| Auth | Passport.js (Google OAuth) |
| Realtime | Socket.IO 4.7 |
| Security | Helmet, CSRF, Rate Limit, bcryptjs |

---

## 🚀 Instalasi

```bash
# 1. Clone
git clone https://github.com/thehanifz/wabot-dev.git
cd wabot-dev

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env sesuai konfigurasi Anda

# 4. Run
npm start
```

---

## ✅ Status

**v4.0.0** — Production Ready — UI/UX Refactor + Full Dashboard
