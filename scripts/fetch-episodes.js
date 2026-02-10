const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const OUTPUT_FILE = path.join(__dirname, "..", "data", "episodes.json");
const MAX_EPISODES = 6;

const PODCASTS = [
  {
    id: "lenny",
    name: "Lenny's Podcast",
    subtitle: "Product | Career | Growth",
    host: "Lenny Rachitsky",
    source: "itunes",
    category: "Business",
    blurb: "面向产品和创业从业者，聚焦增长策略、职业发展与顶尖实践。",
    itunesId: "1627920305",
    youtube: "https://www.youtube.com/@LennysPodcast",
    color: "#4f46e5",
  },
  {
    id: "dankoe",
    name: "Dan Koe",
    subtitle: "Self-Improvement | Business | Philosophy",
    host: "Dan Koe",
    source: "youtube",
    category: "Creator",
    blurb: "个人成长与内容商业化视角，强调长期主义、写作与创作者系统。",
    youtubeHandleUrl: "https://www.youtube.com/@DanKoeTalks/videos",
    youtube: "https://www.youtube.com/@DanKoeTalks",
    color: "#f59e0b",
  },
  {
    id: "ai-daily-brief",
    name: "The AI Daily Brief",
    subtitle: "AI News | Strategy | Industry",
    host: "Nathaniel Whittemore",
    source: "youtube",
    category: "AI",
    blurb: "每日 AI 动态速览，覆盖模型进展、政策变化与商业影响。",
    youtubeHandleUrl: "https://www.youtube.com/@AIDailyBrief/videos",
    youtube: "https://www.youtube.com/@AIDailyBrief",
    color: "#0ea5e9",
  },
  {
    id: "latent-space",
    name: "Latent Space",
    subtitle: "AI Engineering | Builders | Trends",
    host: "Swyx & Alessio",
    source: "youtube",
    category: "AI",
    blurb: "面向 AI 工程和产品实践者，关注工具链、范式和一线经验。",
    youtubeHandleUrl: "https://www.youtube.com/@LatentSpacePod/videos",
    youtube: "https://www.youtube.com/@LatentSpacePod",
    color: "#0891b2",
  },
  {
    id: "jay-clouse",
    name: "Jay Clouse",
    subtitle: "Creator Economy | Audience | Business",
    host: "Jay Clouse",
    source: "youtube",
    category: "Creator",
    blurb: "聚焦创作者商业模式、社区增长和可持续的个人品牌经营。",
    youtubeHandleUrl: "https://www.youtube.com/@jay/videos",
    youtube: "https://www.youtube.com/@jay",
    color: "#14b8a6",
  },
  {
    id: "my-first-million",
    name: "My First Million",
    subtitle: "Business Ideas | Startups | Trends",
    host: "Shaan Puri & Sam Parr",
    source: "youtube",
    category: "Business",
    blurb: "高密度商业点子与案例拆解，适合创业者和增长型团队。",
    youtubeHandleUrl: "https://www.youtube.com/@MyFirstMillionPod/videos",
    youtube: "https://www.youtube.com/@MyFirstMillionPod",
    color: "#dc2626",
  },
  {
    id: "dwarkesh",
    name: "Dwarkesh Patel",
    subtitle: "AI | Economics | Science",
    host: "Dwarkesh Patel",
    source: "youtube",
    category: "AI",
    blurb: "与研究者和思想者深聊 AI、经济与科技长期趋势。",
    youtubeHandleUrl: "https://www.youtube.com/@DwarkeshPatel/videos",
    youtube: "https://www.youtube.com/@DwarkeshPatel",
    color: "#6366f1",
  },
  {
    id: "acquired",
    name: "Acquired",
    subtitle: "Company Histories | Strategy | Tech",
    host: "Ben Gilbert & David Rosenthal",
    source: "youtube",
    category: "Business",
    blurb: "用长篇叙事拆解伟大公司的发展史、护城河与关键决策。",
    youtubeHandleUrl: "https://www.youtube.com/@AcquiredFM/videos",
    youtube: "https://www.youtube.com/@AcquiredFM",
    color: "#7c3aed",
  },
  {
    id: "naval",
    name: "Naval",
    subtitle: "Wealth | Judgment | Leverage",
    host: "Naval Ravikant",
    source: "youtube",
    category: "Creator",
    blurb: "围绕财富、判断力与杠杆思维，偏原则型和第一性原理讨论。",
    youtubeHandleUrl: "https://www.youtube.com/@NavalR/videos",
    youtube: "https://www.youtube.com/@NavalR",
    color: "#2563eb",
  },
  {
    id: "ali-abdaal",
    name: "Ali Abdaal",
    subtitle: "Productivity | Creator Business | Career",
    host: "Ali Abdaal",
    source: "youtube",
    category: "Creator",
    blurb: "生产力与创作者商业化结合，内容实操性高，适合个人品牌成长。",
    youtubeHandleUrl: "https://www.youtube.com/@aliabdaal/videos",
    youtube: "https://www.youtube.com/@aliabdaal",
    color: "#16a34a",
  },
  {
    id: "greg-isenberg",
    name: "Greg Isenberg",
    subtitle: "AI Startups | Communities | Growth",
    host: "Greg Isenberg",
    source: "youtube",
    category: "AI",
    blurb: "聚焦 AI 创业、社区驱动增长和新一代互联网产品机会。",
    youtubeHandleUrl: "https://www.youtube.com/@GregIsenberg/videos",
    youtube: "https://www.youtube.com/@GregIsenberg",
    color: "#ea580c",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestRaw(url, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method,
        headers: {
          "User-Agent": "Mozilla/5.0 (PodcastRadarBot/1.0)",
          Accept: "*/*",
          ...headers,
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          return requestRaw(next, { method, headers, body }).then(resolve).catch(reject);
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 400) {
            const snippet = data.replace(/\s+/g, " ").slice(0, 160);
            return reject(new Error(`HTTP ${res.statusCode} for ${url} :: ${snippet}`));
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function httpGet(url, headers = {}) {
  const res = await requestRaw(url, { method: "GET", headers });
  return res.body;
}

function cleanDescription(raw) {
  if (!raw) return "";
  let main = raw.split(/\n[—–\-]{2,}\s*/)[0] || raw;
  const cutMarkers = [
    "\nBrought to you by",
    "\nSponsors:",
    "\nLinks:",
    "\nShow notes:",
    "\nWhere to find",
    "\nIn this episode, we cover:",
    "\nReferenced:",
    "\nRecommended books:",
    "\nProduction and marketing",
    "\nEpisode transcript:",
    "\nArchive of all",
    "\nEden ",
    "\nRead my letters",
  ];
  for (const marker of cutMarkers) {
    const idx = main.indexOf(marker);
    if (idx > 0) main = main.substring(0, idx);
  }
  main = main.replace(/https?:\/\/\S+/g, "").trim();
  main = main.replace(/[—–\-]{2,}\s*$/g, "").trim();
  main = main
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 1)
    .join("\n");
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

function readPreviousData() {
  try {
    if (!fs.existsSync(OUTPUT_FILE)) return null;
    const raw = fs.readFileSync(OUTPUT_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function previousEpisodesMap(previous) {
  const map = new Map();
  if (!previous?.podcasts) return map;
  for (const p of previous.podcasts) {
    if (p?.id && Array.isArray(p.episodes)) map.set(p.id, p.episodes);
  }
  return map;
}

async function translateToChinese(text) {
  if (!text || text.length < 5) return text;
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodedText}`;
    const raw = await httpGet(url);
    const json = JSON.parse(raw);
    if (json && json[0]) return json[0].map((seg) => seg[0]).join("");
    return text;
  } catch (err) {
    console.warn("    Translation failed:", err.message);
    return text;
  }
}

async function enrichEpisodes(rawEpisodes) {
  const episodes = [];
  for (const ep of rawEpisodes.slice(0, MAX_EPISODES)) {
    const cleanDesc = cleanDescription(ep.description || "");
    let descCN = "";
    try {
      descCN = await translateToChinese(cleanDesc);
    } catch {
      descCN = cleanDesc;
    }

    episodes.push({
      title: ep.title,
      guest: ep.guest || null,
      date: ep.date,
      description: cleanDesc,
      descriptionCN: descCN,
      duration: ep.duration ?? null,
      url: ep.url,
      artworkUrl: ep.artworkUrl || null,
    });

    await sleep(250);
  }
  return episodes;
}

async function fetchFromItunes(podcast) {
  const apiUrl = `https://itunes.apple.com/lookup?id=${podcast.itunesId}&entity=podcastEpisode&limit=${MAX_EPISODES}&sort=recent`;
  const raw = await httpGet(apiUrl);
  const json = JSON.parse(raw);

  const mapped = (json.results || [])
    .filter((r) => r.wrapperType === "podcastEpisode")
    .slice(0, MAX_EPISODES)
    .map((ep) => ({
      title: ep.trackName,
      guest: extractGuest(ep.trackName),
      date: ep.releaseDate,
      description: ep.description || ep.shortDescription || "",
      duration: ep.trackTimeMillis ? Math.round(ep.trackTimeMillis / 60000) : null,
      url: ep.trackViewUrl || ep.collectionViewUrl,
      artworkUrl: ep.artworkUrl600 || ep.artworkUrl160 || null,
    }));

  return enrichEpisodes(mapped);
}

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

function findFirstMatch(text, pattern) {
  const m = text.match(pattern);
  return m ? m[1] : null;
}

async function resolveChannelId(podcast) {
  if (podcast.youtubeChannelId) return podcast.youtubeChannelId;
  const pageUrl = podcast.youtubeHandleUrl || podcast.youtube;
  const html = await httpGet(pageUrl);

  const externalId = findFirstMatch(html, /"externalId":"(UC[^"]+)"/);
  if (externalId) return externalId;

  const browseId = findFirstMatch(html, /"browseId":"(UC[^"]+)"/);
  if (browseId) return browseId;

  throw new Error(`Cannot resolve channel ID from ${pageUrl}`);
}

function parseRelativeTimeToIso(text) {
  if (!text) return new Date().toISOString();
  const normalized = text.toLowerCase().replace(/^streamed\s+/, "").trim();
  const m = normalized.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (!m) return new Date().toISOString();

  const amount = Number(m[1]);
  const unit = m[2];
  const d = new Date();
  if (unit === "minute") d.setMinutes(d.getMinutes() - amount);
  if (unit === "hour") d.setHours(d.getHours() - amount);
  if (unit === "day") d.setDate(d.getDate() - amount);
  if (unit === "week") d.setDate(d.getDate() - amount * 7);
  if (unit === "month") d.setMonth(d.getMonth() - amount);
  if (unit === "year") d.setFullYear(d.getFullYear() - amount);
  return d.toISOString();
}

function collectVideoRenderers(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.videoRenderer) out.push(node.videoRenderer);
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out);
    return out;
  }
  for (const value of Object.values(node)) collectVideoRenderers(value, out);
  return out;
}

function textFromRuns(block) {
  if (!block) return "";
  if (typeof block.simpleText === "string") return block.simpleText;
  if (!Array.isArray(block.runs)) return "";
  return block.runs.map((r) => r.text || "").join("").trim();
}

function extractDescriptionFromRenderer(vr) {
  const desc1 = textFromRuns(vr.descriptionSnippet);
  if (desc1) return desc1;

  const snippets = vr.detailedMetadataSnippets || [];
  if (snippets[0]?.snippetText) {
    return textFromRuns(snippets[0].snippetText);
  }

  return "";
}

function extractInitialData(html) {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const from = start + marker.length;
  const scriptEnd = html.indexOf(";</script>", from);
  if (scriptEnd < 0) return null;

  const jsonText = html.slice(from, scriptEnd);
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

async function fetchYouTubeFromPage(podcast) {
  const pageUrl = podcast.youtubeHandleUrl || `${podcast.youtube}/videos`;
  const html = await httpGet(pageUrl);
  const initialData = extractInitialData(html);
  if (!initialData) {
    throw new Error(`Cannot parse ytInitialData from ${pageUrl}`);
  }

  const renderers = collectVideoRenderers(initialData);

  const seen = new Set();
  const rawEpisodes = [];
  for (const vr of renderers) {
    const videoId = vr.videoId;
    const title = textFromRuns(vr.title);
    if (!videoId || !title || seen.has(videoId)) continue;
    seen.add(videoId);

    rawEpisodes.push({
      title,
      guest: null,
      date: parseRelativeTimeToIso(textFromRuns(vr.publishedTimeText)),
      description: extractDescriptionFromRenderer(vr),
      duration: null,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      artworkUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });

    if (rawEpisodes.length >= MAX_EPISODES) break;
  }

  return enrichEpisodes(rawEpisodes);
}

async function fetchFromYouTube(podcast) {
  const channelId = await resolveChannelId(podcast);

  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const xml = await httpGet(rssUrl);
    const parsed = parseYouTubeRSS(xml)
      .slice(0, MAX_EPISODES)
      .map((vid) => ({
        title: vid.title,
        guest: null,
        date: vid.published,
        description: vid.rawDesc,
        duration: null,
        url: `https://www.youtube.com/watch?v=${vid.videoId}`,
        artworkUrl: `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`,
      }));

    if (parsed.length > 0) {
      return enrichEpisodes(parsed);
    }

    throw new Error("RSS returned no entries");
  } catch (err) {
    console.warn(`    RSS unavailable for ${podcast.name}, fallback to page parser: ${err.message}`);
    return fetchYouTubeFromPage(podcast);
  }
}

async function fetchAll() {
  const started = new Date().toISOString();
  console.log(`[${started}] Fetching all podcasts...`);

  const previous = readPreviousData();
  const prevMap = previousEpisodesMap(previous);
  const results = [];
  let successCount = 0;

  for (const podcast of PODCASTS) {
    console.log(`  Fetching ${podcast.name} (${podcast.source})...`);

    try {
      let episodes;
      if (podcast.source === "youtube") {
        episodes = await fetchFromYouTube(podcast);
      } else {
        episodes = await fetchFromItunes(podcast);
      }

      if (!episodes || episodes.length === 0) {
        throw new Error("No episodes parsed");
      }

      successCount += 1;
      results.push({ ...podcast, episodes });
      console.log(`  ✓ ${podcast.name}: ${episodes.length} episodes`);
    } catch (err) {
      const backup = prevMap.get(podcast.id) || [];
      if (backup.length > 0) {
        results.push({ ...podcast, episodes: backup });
        console.warn(`  ⚠ ${podcast.name}: fetch failed, kept previous ${backup.length} episodes (${err.message})`);
      } else {
        results.push({ ...podcast, episodes: [] });
        console.warn(`  ✗ ${podcast.name}: fetch failed and no backup (${err.message})`);
      }
    }
  }

  const output = {
    lastFetched: new Date().toISOString(),
    podcasts: results,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  if (successCount === 0) {
    console.error(`[${new Date().toISOString()}] Error: all podcasts failed.`);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Done. Saved to ${OUTPUT_FILE}`);
}

fetchAll();
