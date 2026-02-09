const https = require("https");
const fs = require("fs");
const path = require("path");

const ITUNES_API_URL =
  "https://itunes.apple.com/lookup?id=1627920305&entity=podcastEpisode&limit=6&sort=recent";
// When run from scripts/ dir, output to project root's data/
const OUTPUT_FILE = path.join(__dirname, "..", "data", "episodes.json");

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

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = typeof body === "string" ? body : JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// Extract clean summary from raw iTunes description
function cleanDescription(raw) {
  if (!raw) return "";

  // Split by the separator line "—"
  const sections = raw.split("\n—\n");
  // First section is the intro + discussion topics
  let main = sections[0] || raw;

  // Also try splitting by "Brought to you by" as fallback
  const broughtIdx = main.indexOf("\nBrought to you by");
  if (broughtIdx > 0) {
    main = main.substring(0, broughtIdx);
  }

  // Clean up: remove any remaining URLs
  main = main.replace(/https?:\/\/\S+/g, "").trim();

  // Remove trailing "—" lines
  main = main.replace(/\n—\s*$/g, "").trim();

  return main;
}

// Extract guest name from title (after | )
function extractGuest(title) {
  const match = title.match(/\|\s*(.+?)(?:\s*\(|$)/);
  return match ? match[1].trim() : null;
}

// Translate text to Chinese using Google Translate (free, no key needed)
async function translateToChinese(text) {
  try {
    const encodedText = encodeURIComponent(text);
    // Google Translate unofficial API - works for reasonable lengths
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodedText}`;
    const raw = await httpGet(url);
    const json = JSON.parse(raw);
    // Response format: [[["translated text","original text",...],...],...]
    if (json && json[0]) {
      return json[0].map((seg) => seg[0]).join("");
    }
    return text;
  } catch (err) {
    console.warn("Translation failed, using original:", err.message);
    return text;
  }
}

async function fetchEpisodes() {
  console.log(`[${new Date().toISOString()}] Fetching latest episodes...`);

  try {
    const raw = await httpGet(ITUNES_API_URL);
    const json = JSON.parse(raw);

    const rawEpisodes = json.results
      .filter((r) => r.wrapperType === "podcastEpisode")
      .slice(0, 6);

    const episodes = [];

    for (const ep of rawEpisodes) {
      const cleanDesc = cleanDescription(ep.description || ep.shortDescription || "");
      let descCN = "";

      // Translate in chunks if needed (Google Translate has URL length limits)
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
        duration: ep.trackTimeMillis
          ? Math.round(ep.trackTimeMillis / 60000)
          : null,
        url: ep.trackViewUrl || ep.collectionViewUrl,
        episodeUrl: ep.episodeUrl,
        artworkUrl: ep.artworkUrl600 || ep.artworkUrl160 || null,
      });

      // Small delay between translations to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    const output = {
      podcastName: "Lenny's Podcast: Product | Career | Growth",
      host: "Lenny Rachitsky",
      lastFetched: new Date().toISOString(),
      episodes,
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");

    console.log(
      `[${new Date().toISOString()}] Saved ${episodes.length} episodes to ${OUTPUT_FILE}`
    );
    episodes.forEach((ep, i) => {
      console.log(`  ${i + 1}. ${ep.title}`);
    });

    return output;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching episodes:`, err.message);
    throw err;
  }
}

if (require.main === module) {
  fetchEpisodes();
}

module.exports = { fetchEpisodes };
