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
    itunesId: "1627920305",
    youtube: "https://www.youtube.com/@LennysPodcast",
    color: "#6366f1",
  },
  {
    id: "dankoe",
    name: "The Koe Cast",
    subtitle: "Self-Improvement | Business | Philosophy",
    host: "Dan Koe",
    itunesId: "1566479559",
    youtube: "https://www.youtube.com/@DanKoeTalks",
    color: "#f59e0b",
  },
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : require("http");
    mod
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return httpGet(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function cleanDescription(raw) {
  if (!raw) return "";
  // Cut at first separator block: "—", "---", "–––" (with or without text after)
  let main = raw.split(/\n[—–\-]{2,}\s*/)[0] || raw;
  // Cut at common boilerplate markers
  const cutMarkers = [
    "\nBrought to you by", "\nSponsors:", "\nLinks:", "\nShow notes:",
    "\nWhere to find", "\nIn this episode, we cover:", "\nReferenced:",
    "\nRecommended books:", "\nProduction and marketing",
    "\nEpisode transcript:", "\nArchive of all",
  ];
  for (const marker of cutMarkers) {
    const idx = main.indexOf(marker);
    if (idx > 0) main = main.substring(0, idx);
  }
  // Remove URLs, trailing dashes, extra whitespace
  main = main.replace(/https?:\/\/\S+/g, "").trim();
  main = main.replace(/[—–\-]{2,}\s*$/g, "").trim();
  // Remove lines that are just punctuation/whitespace
  main = main.split("\n").filter(l => l.trim().length > 1).join("\n");
  return main;
}

function extractGuest(title) {
  const match = title.match(/\|\s*(.+?)(?:\s*\(|$)/);
  return match ? match[1].trim() : null;
}

async function translateToChinese(text) {
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
    console.warn("Translation failed, using original:", err.message);
    return text;
  }
}

async function fetchPodcastEpisodes(podcast) {
  console.log(`  Fetching ${podcast.name}...`);
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
    try {
      descCN = await translateToChinese(cleanDesc);
    } catch {
      descCN = cleanDesc;
    }

    episodes.push({
      title: ep.trackName,
      guest: extractGuest(ep.trackName),
      date: ep.releaseDate,
      description: cleanDesc,
      descriptionCN: descCN,
      duration: ep.trackTimeMillis ? Math.round(ep.trackTimeMillis / 60000) : null,
      url: ep.trackViewUrl || ep.collectionViewUrl,
      episodeUrl: ep.episodeUrl,
      artworkUrl: ep.artworkUrl600 || ep.artworkUrl160 || null,
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    ...podcast,
    episodes,
  };
}

async function fetchAll() {
  console.log(`[${new Date().toISOString()}] Fetching all podcasts...`);

  try {
    const results = [];
    for (const podcast of PODCASTS) {
      const data = await fetchPodcastEpisodes(podcast);
      results.push(data);
      console.log(`  ✓ ${podcast.name}: ${data.episodes.length} episodes`);
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
