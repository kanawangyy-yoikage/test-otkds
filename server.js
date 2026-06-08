const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const BASE_URL = "https://otakudesu.blog";
const CORS_PROXY = "https://cors.caliph.my.id/";

async function fetchPage(url) {
    try {
        const fullUrl = CORS_PROXY + (url.startsWith('http') ? url : BASE_URL + url);
        const { data } = await axios.get(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        return cheerio.load(data);
    } catch (err) {
        console.error("Fetch error:", err.message);
        return null;
    }
}

// Home + Ongoing + Latest
app.get('/api/home', async (req, res) => {
    const $ = await fetchPage(BASE_URL);
    if (!$) return res.status(500).json({ error: "Gagal mengakses Otakudesu" });

    const ongoing = [];
    const latest = [];

    $('.venz, .thumb, .episode, .item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('h2, h3').text().trim() || $el.find('a').text().trim();
        let url = $el.find('a').attr('href');
        const img = $el.find('img').attr('src') || $el.find('img').attr('data-src');

        if (title && url) {
            if (!url.startsWith('http')) url = BASE_URL + url;
            const item = { title, url, img };
            if (i < 15) ongoing.push(item);
            else latest.push(item);
        }
    });

    res.json({ ongoing, latest });
});

// Search
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Query pencarian diperlukan" });

    const searchUrl = `/?s=${encodeURIComponent(query)}`;
    const $ = await fetchPage(searchUrl);
    if (!$) return res.status(500).json({ error: "Gagal melakukan pencarian" });

    const results = [];

    $('.thumb, .venz, a[href*="/anime/"]').each((i, el) => {
        const $el = $(el);
        const title = $el.find('h2, h3, .jdl').text().trim() || $el.text().trim();
        let url = $el.attr('href') || $el.find('a').attr('href');
        const img = $el.find('img').attr('src') || $el.find('img').attr('data-src');

        if (title && url && !results.some(r => r.title === title)) {
            if (!url.startsWith('http')) url = BASE_URL + url;
            results.push({ title, url, img });
        }
    });

    res.json({ 
        query, 
        results: results.slice(0, 24),
        total: results.length 
    });
});

// Detail Anime
app.get('/api/anime', async (req, res) => {
    let url = req.query.url;
    const $ = await fetchPage(url);
    if (!$) return res.status(500).json({ error: "Gagal load anime" });

    const title = $('h1').first().text().trim() || "Anime";
    const sinopsis = $('.sinopsis, .desc, .entry-content, .paragraph').text().trim().slice(0, 700) + "...";

    const episodes = [];
    $('a[href*="episode"], a[href*="/eps/"]').each((i, el) => {
        episodes.push({
            title: $(el).text().trim(),
            url: $(el).attr('href')
        });
    });

    res.json({ title, sinopsis, episodes });
});

// Episode Player
app.get('/api/episode', async (req, res) => {
    let url = req.query.url;
    const $ = await fetchPage(url);
    if (!$) return res.status(500).json({ error: "Gagal load episode" });

    const title = $('h1').first().text().trim();
    const video_url = $('iframe').attr('src') || null;

    const mirrors = [];
    $('a[href*="download"], a[href*="mirror"], a[href*="gdrive"]').each((i, el) => {
        const link = $(el).attr('href');
        if (link) mirrors.push(link);
    });

    res.json({ title, video_url, mirrors: mirrors.slice(0, 8) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);
    console.log(`🌐 Buka di http://localhost:${PORT}`);
});
