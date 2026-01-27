const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios'); // Perlu install: npm install axios

const app = express();
const upload = multer({ dest: 'uploads/' }); // Tempat simpan gambar sementara
const PORT = 3000;

// Benarkan frontend (NutriSnap) bercakap dengan backend ini
app.use(cors());

// Kunci API (Disimpan di sini, lebih selamat)
const LOGMEAL_TOKEN = "36e194aa6e229b5dd49edbf2a7add2f00a792a21";
const KALORI_API_KEY = "kal_97f41a3a19ba02ffd1eac01bc2338265fd3a1db8c51df3e4e1c96c35f89d78af";

// Endpoint 1: Analisis Gambar (Proxy ke LogMeal)
app.post('/api/analyze-food', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Tiada gambar dimuat naik" });
        }

        console.log("📸 Menerima gambar...", req.file.originalname);

        // Sediakan data untuk dihantar ke LogMeal
        const form = new FormData();
        form.append('image', fs.createReadStream(req.file.path));

        // Panggil LogMeal API (Server-to-Server)
        // Kita guna URL .com seperti dalam dokumentasi YAML
        const response = await axios.post('https://api.logmeal.com/v2/image/segmentation/complete', form, {
            headers: {
                'Authorization': `Bearer ${LOGMEAL_TOKEN}`,
                ...form.getHeaders()
            }
        });

        console.log("✅ LogMeal Berjaya:", response.status);

        // Padam gambar sementara untuk jimat ruang
        fs.unlinkSync(req.file.path);

        // Hantar hasil balik ke Frontend
        res.json(response.data);

    } catch (error) {
        console.error("❌ Ralat LogMeal:", error.response ? error.response.data : error.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); // Padam jika error
        res.status(500).json({ error: "Gagal menganalisis imej", details: error.message });
    }
});

// Endpoint 2: Cari Nutrisi (Proxy ke Kalori.my)
app.get('/api/nutrition', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Sila berikan nama makanan" });

    try {
        console.log("🔍 Mencari nutrisi untuk:", query);
        const response = await axios.get(`https://api.kalori.my/v1/foods/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${KALORI_API_KEY}`
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error("❌ Ralat Kalori.my:", error.message);
        res.status(500).json({ error: "Gagal mencari nutrisi" });
    }
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`🚀 Server Backend NutriSnap sedang berjalan di http://localhost:${PORT}`);
});
