// config/mimetypes.js
// Daftar ini berfungsi sebagai "sumber kebenaran" untuk semua tipe file yang didukung
// oleh aplikasi. Ini memudahkan penambahan atau pengurangan tipe file di masa depan
// tanpa perlu mengubah logika kode di banyak tempat.

const mimeTypeList = [
    // Gambar
    { value: 'image/jpeg', label: 'Gambar JPEG (.jpg, .jpeg)' },
    { value: 'image/png', label: 'Gambar PNG (.png)' },
    { value: 'image/gif', label: 'Gambar GIF (.gif)' },
    { value: 'image/webp', label: 'Gambar WebP (.webp)' },

    // Video
    { value: 'video/mp4', label: 'Video MP4 (.mp4)' },
    { value: 'video/3gpp', label: 'Video 3GP (.3gp)' },
    { value: 'video/webm', label: 'Video WebM (.webm)' }, // Ditambahkan

    // Audio
    { value: 'audio/mpeg', label: 'Audio MP3 (.mp3)' },
    { value: 'audio/ogg', label: 'Audio OGG (Pesan Suara WA, .ogg)' }, // Ditambahkan
    { value: 'audio/oga', label: 'Audio OGA (Varian OGG, .oga)' }, // Label diperbarui
    { value: 'audio/wav', label: 'Audio WAV (.wav)' },
    { value: 'audio/aac', label: 'Audio AAC (.aac)' }, // Ditambahkan
    
    // Dokumen Umum
    { value: 'application/pdf', label: 'Dokumen PDF (.pdf)' },
    { value: 'text/plain', label: 'Teks Polos (.txt)' },
    { value: 'application/json', label: 'JSON (.json)' },
    { value: 'text/csv', label: 'CSV (.csv)' }, // Ditambahkan

    // Dokumen Microsoft Office
    { value: 'application/msword', label: 'Microsoft Word (.doc)' },
    { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Microsoft Word (Modern, .docx)' },
    { value: 'application/vnd.ms-excel', label: 'Microsoft Excel (.xls)' },
    { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Microsoft Excel (Modern, .xlsx)' },
    { value: 'application/vnd.ms-powerpoint', label: 'Microsoft PowerPoint (.ppt)' },
    { value: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'Microsoft PowerPoint (Modern, .pptx)' },

    // Arsip
    { value: 'application/zip', label: 'Arsip ZIP (.zip)' },
    { value: 'application/x-rar-compressed', label: 'Arsip RAR (.rar)' },
    { value: 'application/x-7z-compressed', label: 'Arsip 7z (.7z)' }, // Ditambahkan
];

module.exports = mimeTypeList;
