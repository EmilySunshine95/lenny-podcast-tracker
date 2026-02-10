const https = require("https");
const fs = require("fs");
const path = require("path");

const OUTPUT_FILE = path.join(__dirname, "..", "data", "episodes.json");

const PODCASTS = [
  {
    id: "lenny",
    name: "Lenny's Podcast",
    subtitle: "Product | Career | Growth",
    host: "Lenny Rachitsky",
    source: "itunes",
    itunesId: "1627920305",
    youtube: "https://www.youtube.com/@LennysPodcast",
    color: "#6366f1",
  },
  {
    id: "dankoe",
    name: "Dan Koe",
    subtitle: "Self-Improvement | Business | Philosophy",
    host: "Dan Koe",
    source: "youtube",
    youtubeChannelId: "UCWXYDYv5STLk-zoxMP2I1Lw",
    youtube: "https://www.youtube.com/@DanKoeTalks",
    color: "#f59e0b",
  },
];

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : require("http");
    mod
      .get(url, { headers: { "User-Agent": "Mozilla/5.0", ...headers } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return httpGet(res.headers.location, headers).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ── Description cleaning ──

function cleanDescription(raw) {
  if (!raw) return "";
  let main = raw.split(/\n[—–\-]{2,}\s*/)[0] || raw;
  const cutMarkers = [
    "\nBrought to you by", "\nSponsors:", "\nLinks:", "\nShow notes:",
    "\nWhere to find", "\nIn this episode, we cover:", "\nReferenced:",
    "\nRecommended books:", "\nProduction and marketing",
    "\nEpisode transcript:", "\nArchive of all",
    "\nEden ", "\nRead my letters",
  ];
  for (const marker of cutMarkers) {
    const idx = main.indexOf(marker);
    if (idx > 0) main = main.substring(0, idx);
  }
  main = main.replace(/https?:\/\/\S+/g, "").trim();
  main = main.replace(/[—–\-]{2,}\s*$/g, "").trim();
  main = main.split("\n").filter((l) => l.trim().length > 1).join("\n");
  return main;
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractGuest(title) {
  const match = title.match(/\|\s*(.+?)(?:\s*\(|$)/);
  return match ? match[1].trim() : null;
}

// ── Translation ──

async function translateToChinese(text) {
  if (!text || text.length < 5) return text;
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodedText}`;
    const raw = await httpGet(url);
    const json = JSON.parse(raw);
    if (json && json[0]) {
      return json[0].map((seg) => seg[0]).join("");
    }
    return text;
  } catch (err) {
    console.warn("    Translation failed:", err.message);
    return text;
  }
}

// ── iTunes source (Lenny) ──

async function fetchFromItunes(podcast) {
  const apiUrl = `https://itunes.apple.com/lookup?id=${podcast.itunesId}&entity=podcastEpisode&limit=6&sort=recent`;
  const raw = await httpGet(apiUrl);
  const json = JSON.parse(raw);

  const rawEpisodes = json.results
    .filter((r) => r.wrapperType === "podcastEpisode")
    .slice(0, 6);

  const episodes = [];
  for (const ep of rawEpisodes) {
    const cleanDesc = cleanDescription(ep.description || ep.shortDescription || "");
    let descCN = "";
    try { descCN = await translateToChinese(cleanDesc); } catch { descCN = cleanDesc; }

    episodes.push({
      title: ep.trackName,
      guest: extractGuest(ep.trackName),
      date: ep.releaseDate,
      description: cleanDesc,
      descriptionCN: descCN,
      duration: ep.trackTimeMillis ? Math.round(ep.trackTimeMillis / 60000) : null,
      url: ep.trackViewUrl || ep.collectionViewUrl,
      artworkUrl: ep.artworkUrl600 || ep.artworkUrl160 || null,
    });
    await new Promise((r) => setTimeout(r, 300));
  }
  return episodes;
}

// ── YouTube RSS source (Dan Koe) ──

function parseYouTubeRSS(xml) {
  const entries = xml.split("<entry>").slice(1);
  return entries.map((entry) => {
    const title = decodeXmlEntities(entry.match(/<title>(.*?)<\/title>/)?.[1] || "");
    const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";
    const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || "";
    const rawDesc = decodeXmlEntities(
      entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || ""
    );
    return { title, videoId, published, rawDesc };
  });
}

async function fetchFromYouTube(podcast) {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${podcast.youtubeChannelId}`;
  const xml = await httpGet(rssUrl);
  const parsed = parseYouTubeRSS(xml).slice(0, 6);

  const episodes = [];
  for (const vid of parsed) {
    const cleanDesc = cleanDescription(vid.rawDesc);
    let descCN = "";
    try { descCN = await translateToChinese(cleanDesc); } catch { descCN = cleanDesc; }

    episodes.push({
      title: vid.title,
      guest: null,
      date: vid.published,
      description: cleanDesc,
      descriptionCN: descCN,
      duration: null,
      url: `https://www.youtube.com/watch?v=${vid.videoId}`,
      artworkUrl: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`,
    });
    await new Promise((r) => setTimeout(r, 300));
  }
  return episodes;
}

// ── Main ──

async function fetchAll() {
  console.log(`[${new Date().toISOString()}] Fetching all podcasts...`);

  try {
    const results = [];
    for (const podcast of PODCASTS) {
      console.log(`  Fetching ${podcast.name} (${podcast.source})...`);
      let episodes;
      if (podcast.source === "youtube") {
        episodes = await fetchFromYouTube(podcast);
      } else {
        episodes = await fetchFromItunes(podcast);
      }
      results.push({ ...podcast, episodes });
      console.log(`  ✓ ${podcast.name}: ${episodes.length} episodes`);
    }

    const output = {
      lastFetched: new Date().toISOString(),
      podcasts: results,
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
    console.log(`[${new Date().toISOString()}] Done. Saved to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    process.exit(1);
  }
}

fetchAll();
