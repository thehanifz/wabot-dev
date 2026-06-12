# PRD — Bug Fix: Missing Routes & Admin Panel Issues
**Dokumen:** PRD-BUGFIX-001  
**Versi:** 1.0  
**Tanggal:** 12 Juni 2026  
**Branch Target:** `feature/ui-refactor-phase1`  
**Repo:** https://github.com/thehanifz/wabot-dev  
**Status:** Approved — Siap Implementasi  
**Author:** thehanifz  

---

## 1. Overview & Executive Summary

PRD ini mendokumentasikan perbaikan **7 bug** yang ditemukan setelah implementasi missing routes di commit `daf313b` dan `95a5c2e`. Bug-bug ini mencakup crash interaksi UI, data yang tidak tampil, flash message yang tidak muncul, dan nama user yang selalu salah di topbar.

Semua perbaikan bersifat **non-breaking** — tidak memerlukan migrasi database, tidak ada dependency NPM baru, dan tidak mengubah contract API yang sudah ada.

**Jawaban Open Questions:**
- **OQ-01 (auditLogs):** Cukup empty state untuk sekarang. Implementasi nyata ditunda ke v-next.
- **OQ-02 (/users/settings):** Digabung ke `/users/profile` — tidak perlu halaman terpisah. Link di topbar diarahkan ke `/users/profile`.

---

## 2. Problem Statement

Setelah route baru aktif dan diakses di production (`watsap.thehanifz.fun`), ditemukan masalah berikut:

1. **Modal konfirmasi hapus device muncul kosong** — tanpa title, pesan, dan tombol confirm tidak berfungsi karena Alpine.js tidak bisa serialize fungsi lewat CustomEvent.
2. **Halaman `/users/devices/new` mengembalikan 404** — link di topbar dropdown mengarah ke `/users/settings` yang belum ada route-nya.
3. **Admin dashboard panel tidak tampil** — semua KPI menampilkan `—` karena controller tidak menyediakan variabel yang dibutuhkan view.
4. **Nama user selalu "U" / "User"** di topbar — karena `user.displayName` tidak ada di model User (field yang ada: `name`, `email`).
5. **Redirect `/dashboard` 404** — middleware `ensureGuest` redirect ke `/dashboard` tapi user sudah punya nama `/` sebagai home.
6. **Flash message tidak pernah muncul** — mismatch key antara `req.flash('success', ...)` di controller baru vs `res.locals.success_msg = req.flash('success_msg')` di server.js.
7. **Boolean checkbox settings bisa race condition** — dua input dengan nama sama (`key` = false dan `key` = true) dikirim bersamaan, urutan `Object.entries` tidak deterministik.

---

## 3. Goals & Success Metrics

| Goal | Metrik Sukses |
|------|--------------|
| Zero halaman 404 dari link internal | Semua link di sidebar & topbar tidak menghasilkan `Cannot GET` |
| Modal konfirmasi berfungsi normal | Delete device berhasil hanya setelah user konfirmasi |
| Nama user tampil benar di topbar | Topbar menampilkan `name` atau fallback ke `email` |
| Flash message muncul | Pesan sukses/error tampil setelah save profile & admin settings |
| Admin dashboard menampilkan data | KPI cards menampilkan angka nyata dari DB |
| Tidak ada redirect 404 | Semua redirect post-auth mengarah ke route yang valid |
| Settings boolean tersimpan benar | Nilai checkbox tersimpan konsisten sesuai input user |

---

## 4. Target Users & Personas

### Persona 1 — User / Operator
- **Pain points terdampak:** BUG-01 (modal kosong), BUG-02 (link 404), BUG-03 (flash mismatch), BUG-04 (display name)
- **Halaman:** `/users/devices`, `/users/profile`, `/users/messages`, `/users/activity`

### Persona 2 — Admin
- **Pain points terdampak:** BUG-03 (flash mismatch), BUG-04 (display name), BUG-05 (redirect), BUG-06 (dashboard kosong), BUG-07 (settings)
- **Halaman:** `/admin`, `/admin/devices`, `/admin/logs`, `/admin/settings`

---

## 5. Scope

### In-Scope
- Perbaikan 7 bug yang teridentifikasi
- Semua perubahan dilakukan di branch `feature/ui-refactor-phase1`
- File yang dimodifikasi: `topbar-app.ejs`, `confirm-modal.ejs`, `user-devices.ejs`, `userPages.controller.js`, `adminPages.controller.js`, `admin.controller.js`, `admin-settings.ejs`, `auth.middleware.js`

### Out-of-Scope
- Implementasi nyata `auditLogs` (ditunda ke v-next)
- Pembuatan halaman `/users/settings` terpisah
- Fitur baru apapun
- Migrasi schema database
- Perubahan di branch lain selain `feature/ui-refactor-phase1`

---

## 6. User Stories & Use Cases

---

### Story 1 — BUG-01: Confirm Modal Delete Device

**As a** user, **I want** the delete confirmation modal to show the correct title, device name, and working confirm button, **so that** I can safely delete a device with a clear confirmation.

**Root Cause:**  
Di `user-devices.ejs`, tombol delete memanggil:
```js
onConfirm: () => $el.closest('form').submit()
```
Fungsi ini dikirim via `$dispatch` sebagai property di dalam `CustomEvent.detail`. Browser **tidak bisa serialize fungsi** dalam CustomEvent — saat event diterima oleh listener `@open-confirm-modal.window` di `confirm-modal.ejs`, property `onConfirm` adalah `undefined`. Akibatnya modal muncul dengan Alpine.js default values kosong.

**Acceptance Criteria:**
- [ ] Klik ikon trash → modal muncul dengan title "Hapus Device" dan nama device yang benar
- [ ] Klik "Ya, Hapus" → form submit → device terhapus → redirect dengan flash success
- [ ] Klik "Batal" → modal tutup, tidak ada aksi, halaman tidak berubah
- [ ] Tidak ada JavaScript error di browser console

**Files diubah:** `views/user-devices.ejs`, `views/partials/core/confirm-modal.ejs`  
**Kompleksitas:** Low

**Solusi — gunakan `formId` sebagai referensi DOM:**

```html
<!-- views/user-devices.ejs — form delete pakai id unik -->
<form id="delete-device-<%= device.id %>"
      method="POST" action="/accounts/delete/<%= device.id %>">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
</form>

<!-- Tombol trigger modal — pisah dari form -->
<button type="button"
  class="btn btn-ghost btn-sm text-error"
  @click="$dispatch('open-confirm-modal', {
    title: 'Hapus Device',
    message: 'Yakin ingin menghapus perangkat &quot;<%= device.name %>&quot;? Semua data terkait akan ikut terhapus.',
    confirmLabel: 'Ya, Hapus',
    formId: 'delete-device-<%= device.id %>'
  })">
  <i data-lucide="trash-2" class="w-4 h-4"></i>
</button>
```

```js
// views/partials/core/confirm-modal.ejs — update fungsi confirm()
confirm() {
  if (this.formId) {
    const form = document.getElementById(this.formId);
    if (form) form.submit();
  } else if (typeof this.onConfirm === 'function') {
    this.onConfirm();
  }
  this.close();
},
// Update openModal untuk terima formId
openModal({ title, message, confirmLabel, onConfirm, formId }) {
  this.title = title || 'Konfirmasi';
  this.message = message || 'Apakah Anda yakin?';
  this.confirmLabel = confirmLabel || 'Ya, lanjutkan';
  this.onConfirm = onConfirm || null;
  this.formId = formId || null;
  this.open = true;
},
```

> **Catatan:** Perlu audit semua view lain yang `include('partials/core/confirm-modal')` — pastikan pattern `formId` juga diterapkan jika mereka juga pakai `onConfirm` via `$dispatch`.

---

### Story 2 — BUG-02: Link `/users/settings` 404 di Topbar

**As a** user, **I want** all topbar dropdown links to work, **so that** I can navigate without hitting dead links.

**Root Cause:**  
`topbar-app.ejs` mengarahkan item "Pengaturan" ke `/users/settings`. Route ini tidak terdaftar di `user.routes.js`. Berdasarkan keputusan OQ-02, halaman settings digabung ke profile — link harus diarahkan ke `/users/profile`.

**Acceptance Criteria:**
- [ ] Klik "Pengaturan" di topbar dropdown → navigasi ke `/users/profile` tanpa error
- [ ] Tidak ada link di topbar yang mengarah ke route yang tidak ada
- [ ] Label link boleh tetap "Pengaturan" atau diubah ke "Profil & Pengaturan"

**Files diubah:** `views/partials/nav/topbar-app.ejs`  
**Kompleksitas:** Low

**Solusi:**
```html
<!-- Sebelum -->
<a href="/users/settings" class="gap-2">
  <i data-lucide="settings" class="w-4 h-4"></i> Pengaturan
</a>

<!-- Sesudah -->
<a href="/users/profile" class="gap-2">
  <i data-lucide="settings" class="w-4 h-4"></i> Pengaturan
</a>
```

---

### Story 3 — BUG-03: Flash Key Mismatch

**As a** user, **I want** to see success and error messages after saving my profile or admin settings, **so that** I know whether my action succeeded or failed.

**Root Cause:**  
`server.js` mendaftarkan flash ke `res.locals` dengan key:
```js
res.locals.success_msg = req.flash('success_msg');
res.locals.error_msg   = req.flash('error_msg');
res.locals.error       = req.flash('error');
```
Tapi `userPages.controller.js` dan `adminPages.controller.js` menggunakan key yang tidak terdaftar:
```js
req.flash('success', 'Profil berhasil diperbarui.'); // ← key 'success' tidak ada di locals
req.flash('error', 'Password salah.');               // ← ini kebetulan match, tapi bukan untuk error_msg
```
`flash-alert.ejs` hanya membaca `success_msg`, `error_msg`, dan `error` — sehingga `success` tidak pernah ditampilkan.

**Acceptance Criteria:**
- [ ] Setelah save profile berhasil → flash hijau "Profil berhasil diperbarui." muncul di halaman
- [ ] Setelah password salah → flash merah dengan pesan spesifik muncul
- [ ] Setelah save admin settings berhasil → flash hijau muncul
- [ ] Flash hanya muncul sekali (bukan muncul terus setelah refresh)

**Files diubah:** `controllers/userPages.controller.js`, `controllers/adminPages.controller.js`  
**Kompleksitas:** Low

**Solusi — ganti semua flash key di kedua controller baru:**

| Sebelum | Sesudah |
|---------|---------|
| `req.flash('success', msg)` | `req.flash('success_msg', msg)` |
| `req.flash('error', msg)` *(di controller baru)* | `req.flash('error_msg', msg)` |

> **Penting:** Jangan ubah `req.flash('error', ...)` yang sudah ada di controller lain (`auth`, `dashboard`, `account`) — mereka sudah benar karena `res.locals.error = req.flash('error')` memang terdaftar di server.js.

---

### Story 4 — BUG-04: `user.displayName` Undefined di Topbar

**As a** user, **I want** my name to appear correctly in the topbar avatar and dropdown, **so that** I can confirm I'm logged in as the right account.

**Root Cause:**  
Model `User.js` hanya memiliki field `name`, `email`, `role`, dll. Tidak ada field atau virtual getter `displayName`. `topbar-app.ejs` mengakses `user.displayName` di 3 titik — karena selalu `undefined`, avatar selalu tampil `"U"` dan nama selalu `"User"`.

**Acceptance Criteria:**
- [ ] User dengan `name` terisi → topbar menampilkan nama (`Hanif`, bukan `U`)
- [ ] User tanpa `name` (Google OAuth, field name kosong) → topbar fallback menampilkan email atau bagian sebelum `@`
- [ ] Avatar initial menampilkan huruf pertama yang benar
- [ ] Dropdown menampilkan nama lengkap dan email di bagian header

**Files diubah:** `views/partials/nav/topbar-app.ejs`  
**Kompleksitas:** Low

**Solusi — ganti semua `user.displayName` ke expression inline:**
```html
<!-- Pola pengganti: -->
<!-- user.displayName.charAt(0) → -->
<%= user ? (user.name || user.email || 'U').charAt(0).toUpperCase() : 'U' %>

<!-- user.displayName.split(' ')[0] → -->
<%= user ? (user.name || user.email.split('@')[0]) : 'User' %>

<!-- user.displayName (full) → -->
<%= user ? (user.name || user.email) : '' %>
```

---

### Story 5 — BUG-05: Redirect `/dashboard` di Auth Middleware

**As a** logged-in user, **I want** to be redirected to the correct page if I access `/auth/login` again, **so that** I don't see a 404 error.

**Root Cause:**  
`auth.middleware.js` `ensureGuest` meredirect ke `/dashboard`:
```js
res.redirect('/dashboard');
```
`server.js` mendaftarkan `app.use('/dashboard', dashboardRoutes)`. Perlu dicek isi `dashboard.routes.js` — jika hanya ada subroute (misal `/dashboard/settings`), maka `GET /dashboard` sendiri mengembalikan 404.

**Perbaikan kondisional:**
- Jika `dashboard.routes.js` punya `router.get('/')` → tidak perlu ubah apa-apa
- Jika tidak ada → ubah redirect ke `/` di `ensureGuest`

**Acceptance Criteria:**
- [ ] User yang sudah login akses `/auth/login` → diredirect tanpa 404
- [ ] Redirect mengarah ke halaman dashboard yang valid

**Files diubah:** `middleware/auth.middleware.js` (kondisional), `routes/dashboard.routes.js` (audit)  
**Kompleksitas:** Low

---

### Story 6 — BUG-06: Admin Dashboard KPI & Widget Data Kosong

**As an** admin, **I want** the dashboard to display real platform data, **so that** I can monitor system health and user activity.

**Root Cause:**  
`admin.controller.js` `getAdminDashboardPage` hanya passing `accounts`, `allUsers`, `selectedUser`, `selectedStatus`. View membutuhkan:
- `kpi-cards.ejs` → `totalUsers`, `totalSessions`, `failedJobs`, `systemUptime`
- `recent-users.ejs` → `recentUsers` (array 5 user terbaru)
- `audit-feed.ejs` → `auditLogs` (berdasarkan OQ-01: **cukup empty state / array kosong**)
- `system-health.ejs` → `healthChecks` (sudah punya fallback default di view, tidak perlu dari controller)

**Acceptance Criteria:**
- [ ] KPI "Total Users" → jumlah total user di DB
- [ ] KPI "Total Devices" → jumlah device dengan status `connected`
- [ ] KPI "Failed Jobs" → count `OutgoingMessage` dengan `status = 'failed'` hari ini (sejak 00:00 WIB)
- [ ] KPI "System Uptime" → format `Xj Ym` dihitung dari `process.uptime()`
- [ ] Widget "User Terbaru" → 5 user dengan `createdAt` terbaru, menampilkan nama/email dan role
- [ ] Widget "Audit Feed" → tampil empty state (array kosong, tidak crash)
- [ ] Widget "System Health" → tampil dengan fallback default dari view (tidak perlu data dari controller)

**Files diubah:** `controllers/admin.controller.js`  
**Kompleksitas:** Medium

**Solusi:**
```js
// Tambahkan di getAdminDashboardPage, setelah query accounts & allUsers

const { OutgoingMessage } = require('../models');

// KPI
const totalUsers = allUsers.length;
const totalSessions = accounts.filter(a => a.status === 'connected').length;

const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const failedJobs = await OutgoingMessage.count({
  where: { status: 'failed', createdAt: { [Op.gte]: todayStart } }
});

const uptimeSec = process.uptime();
const uptimeH = Math.floor(uptimeSec / 3600);
const uptimeM = Math.floor((uptimeSec % 3600) / 60);
const systemUptime = `${uptimeH}j ${uptimeM}m`;

// Widget Recent Users
const recentUsers = await User.findAll({
  order: [['createdAt', 'DESC']],
  limit: 5,
  attributes: ['id', 'name', 'email', 'role', 'createdAt']
});

// Audit feed — empty state (OQ-01)
const auditLogs = [];

res.render('admin-dashboard', {
  user: req.user,
  accounts,
  allUsers,
  selectedUser,
  selectedStatus,
  totalUsers,
  totalSessions,
  failedJobs,
  systemUptime,
  recentUsers,
  auditLogs
});
```

> **Catatan:** `recentUsers` menggunakan field `name` dari model. `recent-users.ejs` mengakses `u.displayName` — perlu diubah ke `u.name || u.email` bersamaan dengan fix BUG-04.

---

### Story 7 — BUG-07: Boolean Checkbox Settings Race Condition

**As an** admin, **I want** boolean settings to save the correct value when I toggle checkboxes, **so that** platform configuration is always accurate.

**Root Cause:**  
HTML mengirim dua field dengan nama yang sama untuk pattern boolean checkbox:
```html
<input type="hidden" name="allow_media" value="false">  <!-- selalu terkirim -->
<input type="checkbox" name="allow_media" value="true"> <!-- hanya jika dicentang -->
```
Saat dicentang, Express `req.body.allow_media` menjadi `['false', 'true']` (array). `Object.entries` kemudian memanggil `Setting.upsert` dua kali dengan nilai berbeda — urutan eksekusi async tidak dijamin.

**Acceptance Criteria:**
- [ ] Checkbox dicentang → nilai tersimpan `"true"` di DB
- [ ] Checkbox tidak dicentang → nilai tersimpan `"false"` di DB
- [ ] Tidak ada double-upsert untuk satu key dalam satu request
- [ ] Tidak ada perubahan pada tipe data lain (text, number)

**Files diubah:** `views/admin-settings.ejs`, `controllers/adminPages.controller.js`  
**Kompleksitas:** Low

**Solusi — pakai suffix `__off` pada hidden input:**
```html
<!-- views/admin-settings.ejs — SEBELUM -->
<input type="hidden" name="<%= setting.key %>" value="false">
<input type="checkbox" name="<%= setting.key %>" value="true" ...>

<!-- SESUDAH -->
<input type="hidden" name="<%= setting.key %>__off" value="false">
<input type="checkbox" name="<%= setting.key %>" value="true" ...>
```

```js
// controllers/adminPages.controller.js — updateSettings
for (const [key, value] of Object.entries(updates)) {
  if (skipKeys.includes(key)) continue;
  if (key.endsWith('__off')) continue; // ← tambah ini

  // Normalize boolean: jika key ada versi checkbox-nya yang juga dikirim,
  // nilai checkbox (true) sudah override hidden (__off)
  await Setting.upsert({ key, value: String(value) });
}

// Handle boolean yang tidak dicentang — ambil dari __off keys
for (const [key, value] of Object.entries(updates)) {
  if (!key.endsWith('__off')) continue;
  const realKey = key.replace('__off', '');
  // Hanya upsert false jika checkbox-nya tidak hadir di body
  if (!(realKey in updates)) {
    await Setting.upsert({ key: realKey, value: 'false' });
  }
}
```

---

## 7. Functional Requirements

| ID | Requirement | Story | Priority |
|----|-------------|-------|----------|
| FR-01 | Confirm modal menggunakan `formId` DOM reference pattern, bukan `$el` closure | BUG-01 | Must |
| FR-02 | `confirm-modal.ejs` `openModal()` menerima dan menyimpan `formId` | BUG-01 | Must |
| FR-03 | Link "Pengaturan" di topbar mengarah ke `/users/profile` | BUG-02 | Must |
| FR-04 | Semua `req.flash('success', ...)` di controller baru diganti ke `req.flash('success_msg', ...)` | BUG-03 | Must |
| FR-05 | Semua `req.flash('error', ...)` di controller baru diganti ke `req.flash('error_msg', ...)` | BUG-03 | Must |
| FR-06 | Topbar menggunakan `user.name \|\| user.email` sebagai display name | BUG-04 | Must |
| FR-07 | `recent-users.ejs` menggunakan `u.name \|\| u.email` bukan `u.displayName` | BUG-04 | Must |
| FR-08 | Redirect post-login tidak menghasilkan 404 | BUG-05 | Must |
| FR-09 | `admin.controller.js` menyediakan 6 variabel tambahan: `totalUsers`, `totalSessions`, `failedJobs`, `systemUptime`, `recentUsers`, `auditLogs` | BUG-06 | Must |
| FR-10 | `auditLogs` di-pass sebagai array kosong `[]` | BUG-06 | Must |
| FR-11 | Boolean checkbox menggunakan suffix `__off` pada hidden input | BUG-07 | Should |
| FR-12 | Controller settings skip key yang berakhiran `__off` saat upsert | BUG-07 | Should |

---

## 8. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Tidak ada perubahan schema DB / tidak ada migrasi |
| NFR-02 | Tidak ada dependency NPM baru |
| NFR-03 | Semua perubahan backward-compatible dengan halaman dan controller existing |
| NFR-04 | Query tambahan di admin dashboard tidak menambah latency lebih dari 200ms (gunakan `COUNT` bukan `findAll` untuk angka) |
| NFR-05 | Mekanisme CSRF tetap aktif di semua form yang dimodifikasi |
| NFR-06 | Tidak ada XSS baru yang diintroduksi — nama device di modal menggunakan HTML entity escaping |

---

## 9. Technical Considerations

### Alpine.js CustomEvent Limitation
`$dispatch` di Alpine.js membuat `CustomEvent` dengan `detail` berisi plain object. **Fungsi tidak bisa di-transfer via CustomEvent** karena browser menggunakan structured clone algorithm yang tidak mendukung fungsi. Solusi yang benar adalah meneruskan **ID string** yang bisa di-resolve ke DOM element di sisi penerima.

### Flash Key Convention
Konvensi key yang berlaku di project ini (berdasarkan `server.js`):
| Key | Warna | Digunakan untuk |
|-----|-------|-----------------|
| `success_msg` | Hijau | Aksi berhasil |
| `error_msg` | Merah | Error dari logika bisnis |
| `error` | Merah | Error auth (passport, CSRF, dll) |

Controller lama (`auth`, `dashboard`, `account`) menggunakan `error` untuk auth errors — **jangan diubah**.

### File yang Diubah

| File | Jenis | Bug Fix |
|------|-------|---------|
| `views/partials/nav/topbar-app.ejs` | Edit | BUG-02, BUG-04 |
| `views/partials/core/confirm-modal.ejs` | Edit | BUG-01 |
| `views/partials/dashboard-admin/recent-users.ejs` | Edit | BUG-04 |
| `views/user-devices.ejs` | Edit | BUG-01 |
| `views/admin-settings.ejs` | Edit | BUG-07 |
| `controllers/userPages.controller.js` | Edit | BUG-03 |
| `controllers/adminPages.controller.js` | Edit | BUG-03, BUG-07 |
| `controllers/admin.controller.js` | Edit | BUG-06 |
| `middleware/auth.middleware.js` | Audit + Edit kondisional | BUG-05 |
| `routes/dashboard.routes.js` | Audit | BUG-05 |

---

## 10. UI/UX Requirements & Wireframe Notes

Semua perbaikan bersifat **invisible fix** — tidak ada perubahan visual yang disengaja. Behavior yang berubah:

- **Topbar:** Nama user tampil benar (sebelumnya `"User"`, sesudahnya `"Hanif"` atau `"hanif@email.com"`)
- **Modal Delete:** Title dan pesan muncul (sebelumnya kosong)
- **Flash Alert:** Banner sukses/error muncul setelah save (sebelumnya tidak muncul sama sekali)
- **Admin Dashboard KPI:** Angka nyata (sebelumnya `—`)
- **Admin Dashboard Recent Users:** List 5 user terbaru (sebelumnya empty state)

---

## 11. Dependencies & Risks

| Risk | Dampak | Probabilitas | Mitigasi |
|------|--------|-------------|----------|
| Ada view lain yang pakai `confirm-modal` dengan pattern `onConfirm` fungsi | High | Medium | Grep seluruh `views/` untuk `open-confirm-modal` sebelum push |
| Ada controller lain yang pakai `req.flash('success', ...)` | Medium | Low | Grep `controllers/` untuk `req.flash('success'` dan `req.flash('error'` sebelum push |
| `OutgoingMessage` belum di-import di `admin.controller.js` | Medium | High | Tambah import eksplisit di awal file |
| `recent-users.ejs` masih pakai `u.displayName` setelah BUG-04 fix di topbar | Medium | High | Fix keduanya dalam satu commit |
| Boolean fix `__off` belum ada data setting di DB | Low | Medium | Tetap aman — hanya mempengaruhi form submit, bukan render |

---

## 12. Timeline & Milestones

| Milestone | Bug Fix | File | Estimasi |
|-----------|---------|------|----------|
| **M1 — Critical UI Fixes** | BUG-04, BUG-02 | `topbar-app.ejs`, `recent-users.ejs` | 30 menit |
| **M2 — Flash & Auth** | BUG-03, BUG-05 | `userPages.controller.js`, `adminPages.controller.js`, `auth.middleware.js` | 30 menit |
| **M3 — Modal Fix** | BUG-01 | `confirm-modal.ejs`, `user-devices.ejs` | 45 menit |
| **M4 — Dashboard Data** | BUG-06 | `admin.controller.js` | 45 menit |
| **M5 — Settings Boolean** | BUG-07 | `admin-settings.ejs`, `adminPages.controller.js` | 30 menit |
| **M6 — Regression Test** | All | Manual test semua halaman | 30 menit |

**Total estimasi:** ~3.5 jam

**Urutan prioritas implementasi:**
1. BUG-04 (paling visible, 1 file, effort rendah)
2. BUG-03 (paling impactful untuk UX, 2 file)
3. BUG-02 (link mati, 1 baris)
4. BUG-01 (interaksi delete device)
5. BUG-06 (admin dashboard data)
6. BUG-05 (redirect audit dulu)
7. BUG-07 (settings boolean, low risk)

---

## 13. Open Questions

| # | Pertanyaan | Status | Jawaban |
|---|------------|--------|---------|
| OQ-01 | Apakah `auditLogs` akan diimplementasi nyata atau cukup empty state? | ✅ Resolved | Empty state untuk sekarang. Implementasi nyata di v-next. |
| OQ-02 | Apakah halaman `/users/settings` perlu dibuat terpisah dari `/users/profile`? | ✅ Resolved | Tidak perlu. Link di topbar diarahkan ke `/users/profile`. |
| OQ-03 | Ada controller lain yang pakai `req.flash('success', ...)`? | ⏳ Perlu grep | Grep `controllers/` sebelum implementasi BUG-03 |

---

## Ringkasan Eksekutif

**Top 3 Risiko Terbesar:**
1. **Confirm modal pattern** — Jika ada view lain yang masih pakai `onConfirm` closure via `$dispatch`, mereka akan break jika `confirm-modal.ejs` diubah. Wajib grep dulu.
2. **Flash key grep tidak lengkap** — Controller lama yang kebetulan pakai `req.flash('success', ...)` (bukan `success_msg`) akan tetap tidak menampilkan flash setelah fix. Harus grep menyeluruh.
3. **`OutgoingMessage` import di `admin.controller.js`** — Jika lupa ditambahkan, route `/admin` akan crash dengan error `OutgoingMessage is not defined`.

**Rekomendasi MVP (harus ada di implementasi ini):**
- BUG-01, BUG-02, BUG-03, BUG-04, BUG-06

**Dapat ditunda ke hotfix berikutnya:**
- BUG-05 (tergantung hasil audit `dashboard.routes.js`)
- BUG-07 (hanya relevan jika tabel `Setting` sudah diisi data)

---

*Dokumen ini dibuat berdasarkan analisis kode branch `feature/ui-refactor-phase1` commit `fc263a5` pada 12 Juni 2026.*
