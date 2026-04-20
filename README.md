# WA Gateway - Versi 3.8 (Edisi Ketangguhan Infrastruktur)

Selamat datang di WA Gateway, sebuah platform layanan untuk mengelola beberapa akun WhatsApp secara terpusat. Dibangun di atas library Baileys, layanan ini menyediakan gateway WhatsApp multi-sesi yang andal dan siap diintegrasikan dengan sistem otomasi seperti n8n.

**Versi 3.8** membawa peningkatan signifikan pada stabilitas sistem (**Resilience Update**). Aplikasi kini dilengkapi mekanisme cerdas untuk memastikan sinkronisasi data yang sempurna saat server dimulai ulang, mencegah hilangnya sesi akibat koneksi database yang belum siap.

## ✨ Fitur Baru di v3.8

### 🛡️ **Sistem Proteksi Database (Database Guard)**
- **Smart Startup**: Layanan WA Gateway tidak akan memaksa berjalan sebelum Database PostgreSQL siap sepenuhnya. Ini mencegah error "Crash Loop" saat server baru menyala (reboot).
- **Anti Ghost Session**: Menjamin status sesi WhatsApp dimuat dengan benar hanya setelah koneksi data stabil, menghindari kasus di mana sesi dianggap "hilang" padahal hanya gagal terhubung ke database.
- **Auto-Retry Mechanism**: Jika koneksi database terputus, sistem akan melakukan percobaan koneksi ulang secara otomatis tanpa perlu restart manual.

---

## ✨ Fitur Utama Lainnya

### 🏢 **Fondasi Siap Publikasi**
- **Database Skalabel**: Berjalan di atas **PostgreSQL**, memastikan performa tinggi untuk melayani banyak pengguna secara bersamaan.
- **Halaman Depan Profesional**: Landing page informatif yang menjelaskan fitur dan manfaat layanan kepada pengunjung.
- **Alur Syarat & Ketentuan**: Mewajibkan persetujuan "Terms of Service" bagi pengguna baru untuk perlindungan hukum penyedia layanan.

### 👨‍👩‍👧‍👦 **Platform Multi-Pengguna**
- **Login Terintegrasi**: Pendaftaran dan login mudah menggunakan akun Google (OAuth).
- **Manajemen Mandiri**: Pelanggan memiliki dashboard pribadi untuk menambah, menghubungkan, dan memantau sesi WhatsApp mereka sendiri.

### 🎛️ **Panel Kontrol Admin**
- **Kontrol Terpusat**: Mengelola seluruh pengguna dan sesi dari satu panel admin.
- **Manajemen Kuota**: Mengatur batas jumlah sesi dan izin fitur (seperti pengiriman media) untuk setiap pelanggan secara spesifik.

### ⚙️ **Fitur Teknis Unggulan**
- **Session ID Kustom**: Format ID yang mudah dibaca (`YYMMXXXX`) untuk kemudahan integrasi API.
- **Konfigurasi Spesifik**: Setiap sesi memiliki `webhookUrl` dan `apiKey` unik.
- **Antrian Pesan Cerdas**: Sistem antrian (queue) untuk mencegah pemblokiran akibat pengiriman pesan massal yang terlalu cepat.
- **Monitoring Real-time**: Pantau status koneksi, scan QR code, dan log pesan secara langsung.

---

## ⚠️ Disclaimer
**Proyek ini bukan merupakan API resmi dari WhatsApp dan tidak didukung oleh Meta.** Aplikasi ini bekerja dengan mengotomatiskan WhatsApp Web menggunakan library Baileys. Penggunaan aplikasi ini untuk mengirim spam atau melanggar kebijakan WhatsApp dapat menyebabkan nomor Anda **diblokir secara permanen**.

Gunakan dengan bijak dan bertanggung jawab. Pengembang tidak bertanggung jawab atas segala konsekuensi yang timbul dari penggunaan aplikasi ini.

---

## 🛠️ Tumpukan Teknologi
- **Backend**: Node.js, Express.js
- **Core Library**: @whiskeysockets/baileys
- **Database**: PostgreSQL dengan Sequelize ORM
- **Real-time**: Socket.IO
- **Keamanan**: Passport.js (Google OAuth), Helmet, CSRF, Express Rate Limit

---

## 🚀 Instalasi & Setup

Prasyarat: Node.js (v18+), npm (v10+), Git, dan PostgreSQL Database.

### 1. Kloning Repositori
```bash
git clone [https://github.com/thehanifz/th-whatsapp-gateway-3.5.git](https://github.com/thehanifz/th-whatsapp-gateway-3.5.git)
cd wa-gateway