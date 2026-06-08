const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const BASE_URL = "https://otakudesu.blog";
const CORS_PROXY = "https://api.allorigins.win/raw?url="; // Ganti ke proxy yang lebih stabil

async function fetchPage(url) {
    try {
        const fullUrl = CORS_PROXY + encodeURIComponent(url.startsWith('http') ? url : BASE_URL + url);
        const { data } = await axios.get(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });
        return cheerio.load(data);
    } catch (e) {
        console.error("Error fetch:", e.message);
        return null;
    }
}

// HOME
app.get('/api/home', async (req, res) => {
    const $ = await fetchPage(BASE_URL);
    if (!$) return res.status(500).json({ error: "Gagal mengakses situs" });

    const items = [];

    // Perbaikan selector
    $('div.thumb, div.venz, article, .item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('h2, h3, .jdl').text().trim() || $el.find('a').text().trim();
        let url = $el.find('a').attr('href');
        const img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || $el.find('img').attr('data-lazy');

        if (title && url) {
            if (!url.startsWith('http')) url = BASE_URL + (url.startsWith('/') ? '' : '/') + url;
            items.push({ title: title.substring(0, 60), url, img });
        }
    });

    res.json({ 
        ongoing: items.slice(0, 15), 
        latest: items.slice(15, 30) 
    });
});

// SEARCH
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Kata kunci diperlukan" });

    const $ = await fetchPage(`/?s=${encodeURIComponent(query)}`);
    if (!$) return res.status(500).json({ error: "Gagal pencarian" });

    const results = [];
    $('div.thumb, .venz, article').each((i, el) => {
        const $el = $(el);
        const title = $el.find('h2, h3').text().trim() || $el.text().trim();
        let url = $el.find('a').attr('href');
        const img = $el.find('img').attr('src') || $el.find('img').attr('data-src');

        if (title && url && title.length > 3) {
            if (!url.startsWith('http')) url = BASE_URL + url;
            results.push({ title: title.substring(0, 60), url, img });
        }
    });

    res.json({ results: results.slice(0, 24) });
});

// ANIME DETAIL + EPISODE
app.get('/api/anime', async (req, res) => {
    let url = req.query.url;
    const $ = await fetchPage(url);
    if (!$) return res.status(500).json({ error: "Gagal load halaman" });

    const title = $('h1').first().text().trim() || "Anime";
    const sinopsis = $('.sinopsis, .desc, .entry-content, p').text().trim().slice(0, 650) + "...";

    const episodes = [];
    $('a[href*="episode"], a[href*="/eps/"], .epl a').each((_, el) => {
        episodes.push({
            title: $(el).text().trim(),
            url: $(el).attr('href')
        });
    });

    res.json({ title, sinopsis, episodes: episodes.slice(0, 30) });
});

// EPISODE PLAYER
app.get('/api/episode', async (req, res) => {
    let url = req.query.url;
    const $ = await fetchPage(url);
    if (!$) return res.status(500).json({ error: "Gagal load episode" });

    const title = $('h1').first().text().trim();
    const video_url = $('iframe').attr('src') || null;

    const mirrors = [];
    $('a[href*="download"], a[href*="mirror"], a[href*="gdrive"]').each((_, el) => {
        const link = $(el).attr('href');
        if (link) mirrors.push(link);
    });

    res.json({ title, video_url, mirrors: mirrors.slice(0, 8) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
