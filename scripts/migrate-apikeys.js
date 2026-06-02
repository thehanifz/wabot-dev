/**
 * scripts/migrate-apikeys.js
 *
 * Migrasi satu kali: enkripsi semua API key yang masih plaintext di database.
 * Aman dijalankan ulang — akun yang sudah terenkripsi akan di-skip otomatis.
 *
 * Cara pakai:
 *   node scripts/migrate-apikeys.js
 */

require('dotenv').config();
const { WhatsAppAccount } = require('../models');
const CryptoService = require('../services/crypto.service');

(async () => {
    console.log('=== Migrasi API Key: Plaintext → Encrypted ===\n');

    if (!process.env.ENCRYPTION_KEY) {
        console.error('[ERROR] ENCRYPTION_KEY tidak ditemukan di .env. Batalkan.');
        process.exit(1);
    }

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    try {
        const accounts = await WhatsAppAccount.findAll();

        if (accounts.length === 0) {
            console.log('Tidak ada akun ditemukan di database.');
            process.exit(0);
        }

        console.log(`Ditemukan ${accounts.length} akun. Mulai proses...\n`);

        for (const account of accounts) {
            const id = account.sessionId || account.id;

            if (!account.apiKey) {
                console.log(`[SKIP] ${id} — apiKey kosong`);
                skipped++;
                continue;
            }

            // Deteksi apakah sudah terenkripsi: format hasil CryptoService adalah "hex:hex"
            const isAlreadyEncrypted = /^[a-f0-9]+:[a-f0-9]+$/i.test(account.apiKey);
            if (isAlreadyEncrypted) {
                console.log(`[SKIP] ${id} — sudah terenkripsi`);
                skipped++;
                continue;
            }

            try {
                const encrypted = CryptoService.encrypt(account.apiKey);
                await account.update({ apiKey: encrypted });
                console.log(`[OK]   ${id} — berhasil dimigrasi`);
                migrated++;
            } catch (err) {
                console.error(`[FAIL] ${id} — gagal: ${err.message}`);
                failed++;
            }
        }

        console.log('\n=== Selesai ===');
        console.log(`✅ Berhasil : ${migrated}`);
        console.log(`⏭️  Di-skip  : ${skipped}`);
        console.log(`❌ Gagal    : ${failed}`);

        if (failed > 0) {
            console.warn('\n⚠️  Ada akun yang gagal dimigrasi. Cek log di atas.');
            process.exit(1);
        }

        process.exit(0);

    } catch (err) {
        console.error('[FATAL] Gagal menjalankan migrasi:', err.message);
        process.exit(1);
    }
})();
