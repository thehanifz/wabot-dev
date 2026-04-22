# Riwayat Rilis WA Gateway

Dokumen ini mencatat semua perubahan dan peningkatan signifikan di setiap versi WA Gateway.

---

## v3.9 - Edisi Keamanan & Hardening
**Dirilis pada: 22 April 2026**

Rilis ini berfokus pada **security hardening menyeluruh** berdasarkan PRD Security v1.0.0, v1.1.0, dan v1.2.0. Semua celah keamanan V-01 hingga V-14 telah ditutup.

- **Anti Timing Attack**: Validasi API key menggunakan `crypto.timingSafeEqual()` di semua endpoint.
- **Anti Enumeration**: Semua kegagalan autentikasi mengembalikan HTTP `401` dengan pesan generik.
- **SSRF Protection**: DNS re-validation saat runtime + blocking semua private IP range sebelum pengiriman webhook.
- **HTTPS-Only Webhook**: URL `http://` ditolak saat penyimpanan settings.
- **HMAC Signature**: Webhook dapat dilengkapi header `X-WA-Signature` (SHA256) untuk verifikasi integritas.
- **Axios Hardening**: Timeout 5 detik, batas ukuran response/request, redirect dinonaktifkan.
- **Payload Limit**: Global 2MB, khusus `/webhook/wabot` dibatasi 64KB.
- **File Ownership Check**: User hanya bisa akses file miliknya sendiri di `/uploads/` dan `/temp/`.
- **Rate Limiting Settings**: Endpoint settings dibatasi 20 request per 15 menit.
- **Auto Cleanup Temp**: File sementara dibersihkan otomatis setiap 6 jam dan saat startup.
- **Audit Log Webhook**: Setiap perubahan webhook URL dicatat lengkap (user, domain, IP, timestamp).
- **Input Sanitization**: Nama akun dibersihkan dari karakter HTML/JS untuk mencegah stored XSS.

---

## v3.8 - Edisi Ketangguhan Infrastruktur (Resilience)
**Dirilis pada: 06 Februari 2026**

Fokus utama versi ini adalah stabilitas sistem saat *startup* dan pemulihan otomatis (*recovery*).

- **Database Readiness Guard**: Mencegah aplikasi berjalan (*crash loop*) jika database belum siap. Aplikasi kini akan menunggu ("Waiting for Database...") hingga koneksi PostgreSQL stabil sebelum memulai layanan WhatsApp.
- **Anti Ghost Session**: Memastikan status sesi dimuat dengan benar hanya setelah database terhubung, mencegah hilangnya sesi saat server di-restart mendadak.
- **Auto-Recovery Logic**: Jika koneksi database terputus di tengah jalan, sistem akan mencoba menyambung ulang secara otomatis tanpa perlu restart manual oleh admin.

---

## v3.7 - Edisi Fondasi Publikasi Lanjutan
**Dirilis pada: 16 Oktober 2025**

Versi ini memantapkan fondasi platform untuk siap dipublikasikan sebagai layanan dengan menambahkan alur pengguna yang profesional dan navigasi yang lebih baik.

- **Implementasi Alur "Syarat dan Ketentuan"**: Menambahkan halaman *Terms and Conditions* yang wajib disetujui oleh semua pengguna baru setelah login pertama kali, sebelum bisa mengakses dashboard. Ini adalah langkah krusial untuk perlindungan hukum layanan.
- **Pembuatan Halaman Depan (Landing Page)**: Membuat halaman depan sebagai "wajah" layanan, menjelaskan fitur dan manfaat bagi calon pelanggan.
- **Peningkatan Alur Navigasi**:
    - Pengguna yang sudah login kini bisa mengakses kembali halaman depan.
    - Setelah logout, pengguna diarahkan kembali ke halaman depan, bukan halaman login.
    - Menambahkan link kembali ke halaman depan dari dashboard untuk navigasi yang lebih intuitif.

---

## v3.6 - Edisi Skalabilitas & Kontrol Admin
**Dirilis pada: 15 Oktober 2025**

Fokus pada peningkatan arsitektur backend dan penyempurnaan fitur panel admin untuk persiapan layanan multi-pengguna.

- **Migrasi Database ke PostgreSQL**: Mengganti database dari SQLite ke PostgreSQL untuk stabilitas, performa, dan skalabilitas yang jauh lebih baik dalam lingkungan multi-pengguna.
- **Penyempurnaan Panel Admin**: Menambahkan modal konfirmasi yang lebih aman saat admin menghapus sesi pengguna, menyamakan pengalaman dengan dashboard pengguna.
- **Perbaikan Filter Admin**: Memperbaiki bug di mana fitur filter berdasarkan pengguna dan status di panel admin tidak berfungsi.

---

## v3.5 - Edisi Multi-Pengguna & Kontrol Admin
**Dirilis pada: 14 Oktober 2025**

Versi ini merupakan lompatan besar yang mengubah aplikasi dari alat pribadi menjadi platform multi-pengguna yang matang dengan kontrol admin yang terpusat.

### ✨ Fitur Baru & Peningkatan Utama

#### 👨‍👩‍👧‍👦 **Sistem Multi-Pengguna & Peran**
- **Login Terbuka**: Semua pengguna dengan akun Google kini bisa login. Peran `admin` atau `user` ditentukan secara otomatis berdasarkan daftar email di `.env`.
- **Batas Sesi per Pengguna**: Setiap pengguna memiliki batas sesi (`sessionLimit`). Pengguna baru mendapatkan batas default 1, sementara admin mendapatkan batas yang lebih tinggi.
- **Penghapusan Fitur Registrasi**: Sistem pendaftaran manual dan peran `trial`/`pending` telah dihapus total, menyederhanakan alur kerja menjadi `user` dan `admin`.

#### 🎛️ **Panel Admin Terpusat**
- **Navigasi Panel Admin**: Admin kini memiliki menu navigasi khusus dengan akses ke "All Sessions" dan "Manage Users".
- **Manajemen Sesi Terpusat**: Admin dapat melihat semua sesi dari semua pengguna dalam satu halaman.
- **Filter Canggih**: Admin dapat memfilter sesi berdasarkan email pengguna dan status koneksi (`connected`, `disconnected`, `other`).
- **Kontrol Penuh Admin**:
    - **Toggle Izin Media**: Admin dapat mengaktifkan atau menonaktifkan izin pengiriman media untuk setiap sesi secara individual.
    - **Edit Batas Sesi**: Admin dapat mengubah batas sesi untuk setiap pengguna melalui halaman "Manage Users".
    - **Hapus Sesi Pengguna**: Admin dapat menghapus sesi milik pengguna mana pun dengan aman melalui modal konfirmasi.

#### 🔌 **Peningkatan Sesi & API**
- **Session ID Kustom**: Mengganti `accountId` numerik dengan `sessionId` berformat `YYMMXXXX` (contoh: `2510A4B1`) untuk semua interaksi API, membuatnya lebih mudah dibaca dan aman.
- **API Cerdas**: *Endpoint* API `/send-media` kini mematuhi pengaturan `allowMedia` dan `mimetypes`/`maxFileSize` yang ditetapkan oleh admin untuk setiap sesi.
- **Webhook yang Disempurnakan**: *Payload webhook* yang dikirim ke n8n kini menyertakan `sessionId` dan menyembunyikan `accountId` internal.

#### ⚙️ **Peningkatan Pengalaman Pengguna (UX)**
- **Info Kontak Admin**: Menampilkan informasi kontak admin (dari `.env`) di halaman login dan dashboard untuk memudahkan pengguna meminta bantuan.
- **Indikator Batas Sesi**: Dashboard pengguna kini menampilkan jumlah sesi yang digunakan dan batas maksimalnya (contoh: `Sessions used: 1 / 1`).

---

## v3.4 - Edisi Stabilitas Koneksi
**Dirilis pada: 13 Oktober 2025**
- **Perbaikan Koneksi Kritis**: Mengatasi masalah `statusCode: 405` dan `515` yang menyebabkan kode QR gagal muncul dengan memperbarui *library* Baileys dan mengimplementasikan logika koneksi yang lebih cerdas (membersihkan sesi, membuat direktori, dan menggunakan versi Baileys yang spesifik).
- **Stabilisasi Server**: Menghentikan masalah *server restart* terus-menerus dengan menambahkan *file* konfigurasi `nodemon.json` untuk mengabaikan perubahan di luar folder kode.

---

## v3.3 - Edisi Peningkatan Sesi
**Dirilis pada: 11 Oktober 2025**
- **Implementasi Session ID**: Memperkenalkan `sessionId` kustom untuk menggantikan `accountId` internal pada interaksi API.
- **Logika Pemulihan Sesi**: Mengembangkan logika koneksi ulang yang lebih "sabar" untuk mencoba memulihkan sesi yang terputus secara otomatis.
- **Peningkatan Keamanan API**: Memperbaiki celah keamanan di mana `allowMedia` tidak divalidasi di semua *endpoint* pengiriman media.

---

## v3.2 - Edisi Upload Media Fleksibel
**Dirilis pada: 09 Oktober 2025**
- **Dukungan Upload Multipart Fleksibel**: *Endpoint* `/api/send-media` kini dapat menerima file upload dengan nama *field* yang dinamis.
- **Perbaikan Sistem Buffer dan Media**: Memperbaiki masalah dalam pengolahan buffer media saat disimpan ke *database* dan dikirim melalui Baileys.

---

## v3.1 - Edisi Keamanan & Stabilitas
**Dirilis pada: 06 Oktober 2025**
- **Enkripsi Data Sensitif di Database**: `apiKey` dan `webhookUrl` dienkripsi menggunakan AES-256.
- **Pembatasan Laju API (Rate Limiting)**: Melindungi *endpoint* API dari serangan DoS.
- **Antrian Pesan Keluar (Anti-Blokir)**: Mengimplementasikan sistem antrian cerdas untuk mengurangi risiko pemblokiran.

---

## v3.0 - Edisi Dashboard Interaktif
**Dirilis pada: 04 Oktober 2025**
- **Pembaruan Real-time dengan WebSockets**: Status koneksi, QR code, dan pesan baru kini muncul di dashboard secara instan.
- **Log Pesan di Dashboard**: Menambahkan tabel riwayat pesan masuk dan keluar yang diperbarui secara real-time.
- **Konfigurasi per Sesi**: Memperkenalkan pop-up "Settings" untuk mengatur Webhook URL dan API Key yang unik untuk setiap sesi.

---

## v2.0 - Edisi Media & API Fleksibel
**Dirilis pada: 03 Oktober 2025**
- **Penanganan Media Masuk**: Aplikasi kini dapat menerima pesan media (gambar, dokumen, dll.) dan mengirimkan URL-nya melalui webhook.
- **API Pengiriman Media**: Memperkenalkan dua *endpoint* API untuk pengiriman pesan keluar: `/api/send` (untuk teks/media via URL) dan `/api/send-media` (untuk *upload* file).

---

## v1.0 - Rilis Fondasi Awal
**Dirilis pada: 02 Oktober 2025**
- **Manajemen Multi-Akun**: Kemampuan dasar untuk menambah dan menghubungkan beberapa akun WhatsApp.
- **Dashboard Sederhana**: Tampilan web untuk memonitor status koneksi dan melihat QR code.
- **Webhook Pesan Masuk**: Mengirim notifikasi pesan teks yang masuk ke satu URL webhook global.
- **Login Aman**: Mengimplementasikan autentikasi pengguna menggunakan Google OAuth 2.0.