# WA Gateway - Versi 3.9 (Edisi Keamanan & Hardening)

Selamat datang di WA Gateway, sebuah platform layanan untuk mengelola beberapa akun WhatsApp secara terpusat. Dibangun di atas library Baileys, layanan ini menyediakan gateway WhatsApp multi-sesi yang andal, aman, dan siap diintegrasikan dengan sistem otomasi seperti n8n.

**Versi 3.9** merupakan rilis besar yang berfokus pada **security hardening end-to-end**. Update ini menutup berbagai celah keamanan kritis seperti timing attack, SSRF, enumeration, dan cross-tenant access, sehingga sistem kini jauh lebih aman untuk penggunaan production multi-user.

---

## 🔐 Fitur Baru di v3.9 (Security Hardening)

### 🛡️ **Perlindungan API & Autentikasi**
- **Constant-Time API Key Comparison**: Menggunakan `crypto.timingSafeEqual()` untuk mencegah timing attack saat validasi API key.
- **Unified Auth Response (Anti-Enumeration)**: Semua kegagalan autentikasi kini selalu mengembalikan `401` dengan pesan generik.
- **Tidak Bisa Dibedakan**: Penyerang tidak bisa membedakan apakah `sessionId` salah atau `apiKey` salah.

---

### 🌐 **Webhook Security & SSRF Protection**
- **DNS Re-validation**: Validasi DNS dilakukan saat runtime sebelum mengirim webhook untuk mencegah DNS rebinding attack.
- **Private IP Blocking**: Semua IP internal diblokir (127.0.0.1, 10.x, 192.168.x, dll).
- **HTTPS-Only Webhook**: Hanya URL `https://` yang diizinkan.
- **HMAC Signature (Optional)**: Webhook dapat dilengkapi signature `X-WA-Signature` (SHA256) untuk verifikasi integritas.

---

### ⚙️ **HTTP & Resource Hardening**
- **Axios Hardening**:
  - Timeout dikurangi menjadi 5 detik
  - Maks response: 100KB
  - Maks request: 500KB
  - Redirect dinonaktifkan
- **Payload Limit Global**: Maksimal request body 2MB
- **Webhook Endpoint Limit**: Khusus `/webhook/wabot` dibatasi 64KB

---

### 📁 **Multi-Tenant Security**
- **File Ownership Validation**:
  - User hanya bisa akses file miliknya sendiri
  - Berlaku untuk `/uploads/` dan `/temp/`
- **Cross-Tenant Access Blocked**: Tidak bisa lagi akses file user lain

---

### 🚦 **Rate Limiting & Abuse Prevention**
- **Sensitive Endpoint Rate Limit**:
  - `/accounts/:id/settings` dibatasi 20 request / 15 menit
- **Proteksi Brute Force & Data Scraping**

---

### 🧹 **Operational Security & Stability**
- **Auto Cleanup Temp Files**:
  - File temp dihapus setiap 6 jam
  - Cleanup saat server startup
- **Startup Recovery Improvement**
- **Safer Logging**:
  - Tidak lagi menyimpan full payload webhook ke log

---

### 🧾 **Audit & Monitoring**
- **Webhook Change Audit Log**:
  - Mencatat perubahan webhook URL
  - Menyimpan domain lama & baru
  - Menyertakan user, IP, dan timestamp
- **Security Event Logging**:
  - SSRF blocked
  - Unauthorized file access

---

### 🧼 **Input Sanitization**
- **Account Name Sanitization**:
  - Menghapus karakter berbahaya (`< > " ' &`)
  - Mencegah stored XSS

---

## ✨ Fitur Utama

### 🏢 **Fondasi Siap Publikasi**
- PostgreSQL database (scalable)
- Landing page profesional
- Terms of Service flow

### 👨‍👩‍👧‍👦 **Platform Multi-Pengguna**
- Login Google OAuth
- Dashboard per user
- Session management mandiri

### 🎛️ **Panel Admin**
- Kontrol semua user & session
- Limit session per user
- Toggle izin media

### ⚙️ **Fitur Teknis**
- Session ID custom (YYMMXXXX)
- Webhook per session
- API Key per session
- Queue message anti-block
- Monitoring real-time (Socket.IO)

---

## ⚠️ Disclaimer
**Proyek ini bukan API resmi WhatsApp.**

Aplikasi ini menggunakan WhatsApp Web automation (Baileys). Penggunaan untuk spam atau pelanggaran kebijakan dapat menyebabkan nomor diblokir permanen.

Gunakan dengan bijak.

---

## 🛠️ Tech Stack
- Node.js, Express.js
- Baileys
- PostgreSQL + Sequelize
- Socket.IO
- Passport.js (Google OAuth)
- Security: Helmet, CSRF, Rate Limit

---

## 🚀 Instalasi

### 1. Clone Repo
```bash
git clone https://github.com/thehanifz/wabot-dev.git
cd wabot-dev
```

### 2. Install
```bash
npm install
```

### 3. Setup Environment
```bash
cp .env.example .env
```

### 4. Run
```bash
npm start
```

---

## ✅ Status
✅ Production Ready (Security Hardened v3.9.0)