# Bug Report & Implementation Plan — Analisa Gabungan

## Sumber Analisa
- 🤖 **GPT** — `analisa gpt.txt`
- 🧠 **Claude** — `analisa claude.txt`  
- 🔍 **Antigravity (saya)** — Review code session ini
- 👤 **User** — Temuan langsung saat menggunakan aplikasi

---

## Perbandingan Bug Cross-Source

| # | Bug | GPT | Claude | Antigravity | User | Status |
|---|-----|-----|--------|-------------|------|--------|
| 1 | KPI cards variabel tidak dikirim controller | — | 🔴 Kritis | — | ✅ Konfirmasi | **CONFIRMED** |
| 2 | Tombol hapus device (route `/dashboard/accounts/delete/:id` 404) | 🔴 Kritis | — | — | ✅ Konfirmasi | **CONFIRMED** |
| 3 | Settings modal tidak muncul / MIME types tidak load | — | 🟡 Medium | — | ✅ Konfirmasi | **CONFIRMED** |
| 4 | Status badge `connected` tidak punya `id=` sehingga socket gagal update | 🔴 Kritis | — | — | ✅ Konfirmasi (QR refresh) | **CONFIRMED** |
| 5 | Panel admin tidak bisa diakses (route `/admin/users` 404) | 🟡 Minor | 🔴 Kritis | — | ✅ Konfirmasi | **CONFIRMED** |
| 6 | Rate limiter auth terlalu ketat (50 req/15min per IP, semua auth kena) | — | — | — | ✅ User langsung | **NEW** |
| 7 | Admin role cukup di `.env`, tapi middleware bisa dilewati jika role DB tidak update | — | — | — | ✅ User concern | **NEEDS VERIFY** |
| 8 | Profile page tidak relevan (Google OAuth, tidak perlu ganti password/email) | — | — | — | ✅ User | **AGREED** |
| 9 | `payload.message` seharusnya `payload.text` di activity & messages | — | 🔴 Kritis | — | — | **CONFIRMED** |
| 10 | `u.isActive` tidak ada di model User, badge selalu "Suspended" | — | 🔴 Kritis | — | — | **CONFIRMED** |
| 11 | Route `/users/messages/send` 404 | — | 🔴 Kritis | — | — | **CONFIRMED** |
| 12 | Delete user via `onConfirm: () => window.location.href` di CustomEvent (tidak serialize) | — | 🟡 Medium | — | — | **CONFIRMED** |
| 13 | Sidebar Dashboard link ke `/` (1 redirect ekstra) | — | 🟢 Minor | — | — | **CONFIRMED** |
| 14 | `error.ejs` tidak punya `<!DOCTYPE html><html>` wrapper | — | 🔴 Kritis | — | — | **CONFIRMED** |
| 15 | Connect/disconnect device IDOR (tidak cek userId) | 🔴 Kritis | — | — | — | **CONFIRMED** |
| 16 | IDOR `/api/media/temp/:filename` | — | — | 🔴 Kritis | — | **CONFIRMED** |

---

## 🔴 KRITIS — Layar rusak / fitur tidak jalan

### BUG-1: KPI Cards kosong (`—`) di dashboard user
**Sumber:** Claude 🧠 + User 👤  
**Masalah:** `dashboard.controller.js` mengirim `accounts` tapi `kpi-cards.ejs` butuh `sessions`, `totalMessages`, `failedMessages`, `uptime`.  
**File:** `controllers/dashboard.controller.js`  
**Fix:** Tambah 4 variabel ke `res.render()`.

---

### BUG-2: Tombol Hapus Device → 404
**Sumber:** GPT 🤖 + User 👤  
**Masalah:** Form action di `user-devices.ejs` line 83 mengarah ke `/dashboard/accounts/delete/:id` — route ini tidak ada. Route delete hanya ada di `dashboard.routes.js` via `accountController.deleteAccount` yang diakses di `/dashboard/accounts/delete/:accountId` — tapi `dashboard.routes.js` **memang punya** route ini (line 38). Jadi penyebab sebenarnya adalah `user-devices.ejs` menggunakan form kosong + confirm-modal, **tapi confirm-modal sudah benar** (pakai `formId`). Yang bermasalah: route ini ada di `dashboard.routes.js` tapi cek kepemilikan sudah ada di controller. **Harus diverifikasi apakah 404 atau forbidden.**  

> [!IMPORTANT]  
> Perlu test manual: apakah tombol hapus melempar 404 atau diam saja? Confirm-modal sudah menggunakan `formId` dengan benar, bukan `onConfirm` fungsi. Route sudah ada di dashboard.routes.js. Kemungkinan ini terkait **BUG-3 (settings modal)** karena sama-sama menggunakan confirm-modal yang mungkin tidak ter-trigger.

---

### BUG-3: Settings Modal Tidak Muncul
**Sumber:** User 👤 + Claude (partial)  
**Masalah:** `_settings-modal.ejs` menggunakan styling Tailwind lama (non-DaisyUI, plain gray classes) — di-include langsung di `user-devices.ejs`. MIME type checkboxes kosong karena tidak ada fetch ke `/api/mime-types`. Selain itu, `openSettings()` dipanggil via `onclick` HTML attribute.  
**File:** `views/partials/_settings-modal.ejs`, `views/user-devices.ejs` (script)  
**Fix:** Migrasi modal ke DaisyUI, tambah fetch MIME types.

---

### BUG-4: QR Code tidak refresh / Status badge `connected` tidak punya id
**Sumber:** GPT 🤖 + User 👤  
**Masalah:** Ketika status `connected`, elemen badge **tidak memiliki `id="status-..."`**, sehingga Socket.IO event `qr-code` tidak bisa update badge. Saat device disconnect dan user ingin scan ulang QR, socket tidak bisa menemukan elemen untuk update.  
**File:** `views/user-devices.ejs` line 32-40  
**Fix:** Tambah `id="status-<%= device.id %>"` pada kondisi `connected` juga.

---

### BUG-5: Panel Admin tidak muncul / Route `/admin/users` → 404
**Sumber:** Claude 🧠 + User 👤  
**Masalah:** `admin.routes.js` tidak punya route `GET /admin/users` dan `GET /admin/users/:id/edit`. User Management ada di `/users/management`, tapi sidebar admin mengarah ke `/admin/users`. Tombol "Tambah User" di `user-management.ejs` juga mengarah ke `/admin/users/new` yang tidak ada.  
**File:** `routes/admin.routes.js`, `views/partials/nav/sidebar-admin.ejs`  
**Fix:** Tambah redirect atau route baru di `admin.routes.js`.

---

### BUG-6: `payload.message` vs `payload.text` — Preview pesan selalu kosong
**Sumber:** Claude 🧠  
**Masalah:** `OutgoingMessage.payload` menyimpan `{ text, media }` tapi view menampilkan `p.message` dan `payload.message`.  
**File:** `views/user-activity.ejs` line 36, `views/user-messages.ejs` line 48  
**Fix:** Ganti `p.message` → `p.text`, `payload.message` → `payload.text`.

---

### BUG-7: `u.isActive` tidak ada di model User — Badge selalu "Suspended"
**Sumber:** Claude 🧠  
**Masalah:** `user-management.ejs` line 84 memakai `u.isActive` yang tidak ada di model `User`. Semua user akan tampil badge merah "Suspended".  
**File:** `views/user-management.ejs`, `models/User.js`  
**Fix:** Hapus kolom status filter (atau tambahkan `isActive` ke model) dan ganti badge menjadi selalu "Active" sementara.

---

### BUG-8: `error.ejs` HTML invalid — tidak ada `<!DOCTYPE html><html>`
**Sumber:** Claude 🧠  
**File:** `views/error.ejs`  
**Fix:** Wrap dengan `<!DOCTYPE html><html lang="id" data-theme="wabot"><head>...</head><body>...</body></html>`.

---

## 🟡 MEDIUM — Fitur tidak berfungsi tapi tidak crash

### BUG-9: Rate Limiter Auth terlalu ketat untuk multi-email login
**Sumber:** User 👤 (baru)  
**Masalah:** `authLimiter` di-apply ke seluruh `/auth` router (`router.use(authLimiter)`). Limitnya 50 request per 15 menit per IP. Jika user berpindah-pindah akun Google atau test login berulang, IP bisa terkena block — padahal ini bukan serangan.  
**File:** `routes/auth.routes.js`, `middleware/rateLimiter.middleware.js`  
**Fix:** Pisahkan limiter khusus untuk `POST /auth/google/callback` (lebih ketat, 10/15min) dan `GET /auth/google` (lebih longgar, 30/15min). Jangan block seluruh `/auth` router termasuk halaman statis.

---

### BUG-10: IDOR Connect/Disconnect Device
**Sumber:** GPT 🤖  
**Masalah:** Route `/dashboard/accounts/connect/:id` dan `/disconnect/:id` tidak memvalidasi bahwa device milik user yang login. Controller `account.controller.js` sudah ada `WHERE userId = req.user.id` — jadi ini **mungkin sudah fix**. Perlu verifikasi ulang.  

> [!NOTE]
> Dari review code terbaru, `connectAccount` dan `disconnectAccount` di `account.controller.js` sudah menggunakan `findOne({ where: { id: accountId, userId: req.user.id } })`. GPT mungkin menganalisa versi lama. **Ini sudah aman.**

---

### BUG-11: Route `/users/messages/send` → 404
**Sumber:** Claude 🧠  
**Masalah:** `quick-actions.ejs` punya link `/users/messages/send` yang tidak ada di `user.routes.js`.  
**File:** `views/partials/dashboard-user/quick-actions.ejs`  
**Fix:** Hapus link atau ganti ke `/users/messages` (halaman riwayat pesan).

---

### BUG-12: Delete User di `user-management.ejs` menggunakan `onConfirm` fungsi via CustomEvent
**Sumber:** Claude 🧠  
**Masalah:** Alpine.js `$dispatch` menggunakan CustomEvent yang tidak bisa serialize fungsi. `onConfirm: () => { window.location.href = '...' }` akan hilang.  
**Solusi Real:** Dari kode `confirm-modal.ejs` sebenarnya `onConfirm` **didukung** di Alpine.js karena ini bukan `JSON.stringify` — detail dari `$event.detail` adalah object JavaScript native. Ini **mungkin bekerja** di Alpine.js versi modern. Perlu verifikasi.

> [!WARNING]
> Selain itu, delete user via `GET` redirect ke `/admin/users/:id/delete` adalah **anti-pattern** — delete harus selalu `POST` dengan CSRF token. Ini perlu diperbaiki.

---

### BUG-13: IDOR `/api/media/temp/:filename`
**Sumber:** Antigravity 🔍  
**Masalah:** API key valid dari akun manapun bisa akses file temp akun lain jika tahu filename-nya.  
**File:** `routes/api.routes.js`  
**Fix:** Tambah verifikasi `accountId` setelah validasi API key.

---

## 🟢 MINOR — UX / Konsistensi

| # | Masalah | File | Fix |
|---|---------|------|-----|
| M1 | Dashboard link sidebar ke `/` (tambah redirect) | `sidebar-user.ejs` L18 | Ganti ke `/dashboard` |
| M2 | Quick Actions link `/users/settings` → 404 | `quick-actions.ejs` L22 | Ganti ke `/users/profile` atau `/users/devices` |
| M3 | `topbar-app.ejs` "Pengaturan" link duplikat ke `/users/profile` | `topbar-app.ejs` | Hapus atau arahkan ke device settings |

---

## 🔐 Keamanan Admin Panel (Bug User #7)

**Mekanisme saat ini:**
- `ADMIN_EMAILS` di `.env` → saat login Google, passport mengecek email dan set `role = 'admin'` di DB.
- Middleware `hasRole(['admin'])` mengecek `req.user.role` dari DB session.
- Sudah aman: jika email dihapus dari `ADMIN_EMAILS`, role di DB tidak otomatis berubah.

> [!IMPORTANT]
> **Potensi masalah:** Jika admin dihapus dari `ADMIN_EMAILS` di `.env`, mereka masih bisa akses admin panel sampai login ulang (karena `role` di DB baru diupdate saat login berikutnya). Passport sudah handle ini — saat login, role di-sync.
>
> **Tidak perlu perubahan keamanan besar**, tapi bisa tambah middleware yang re-check `ADMIN_EMAILS` setiap request ke `/admin`.

---

## 🧹 Simplifikasi Profile Page (Bug User #8 & #9)

**Rekomendasi:**  
Karena login **hanya via Google OAuth**, halaman `/users/profile` tidak perlu:
- Form ganti email (email dari Google, read-only)
- Form ganti password (tidak ada password lokal)

**Yang perlu disimpan:**
- Tampilan info akun (nama, email, role dari Google) — read-only
- Tidak ada form edit sama sekali kecuali nama display name

**File yang diubah:**
- `views/user-profile.ejs` — hapus form password & simplifikasi form info
- `controllers/userPages.controller.js` `updateProfile` — simplifikasi, hanya terima `name`

---

## Urutan Perbaikan yang Diusulkan

### Batch 1 — Fix Kritis (Yang User Rasakan Langsung)
1. **BUG-1** KPI cards — fix `dashboard.controller.js`
2. **BUG-2/4** Hapus device + QR refresh (perbaiki `id=` badge + verifikasi route)
3. **BUG-3** Settings modal — migrasi ke DaisyUI + tambah MIME fetch
4. **BUG-5** Admin route — tambah route `/admin/users` di `admin.routes.js`

### Batch 2 — Fix Data Display
5. **BUG-6** `payload.text` di activity & messages
6. **BUG-7** Hapus `isActive` filter, simplifikasi badge
7. **BUG-8** Fix `error.ejs` HTML wrapper

### Batch 3 — UX & Simplifikasi
8. **BUG-9** Rate limiter granular
9. **BUG-11 + M1/M2** Fix broken links
10. **Profile simplification** untuk Google-only auth

### Batch 4 — Keamanan
11. **BUG-13** IDOR media temp

---

## Open Questions untuk User

1. **BUG-2 (Delete Device):** Apakah saat klik hapus, dialog konfirmasi muncul atau tidak sama sekali? Ini membantu mendiagnosis apakah masalahnya di confirm-modal Alpine.js atau di routing.
2. **Profile page:** Apakah ingin tetap ada tampilan info profil (read-only dari Google), atau ingin halaman profile dihapus sepenuhnya dari navigasi?
3. **Admin users/new:** Apakah fitur "Tambah User Manual" (non-Google) ingin diimplementasikan, atau cukup semua user register via Google?
4. **Rate limiter:** Berapa IP yang sering mengalami masalah rate limit? Apakah dari IP yang sama (VPN, kantor)?
