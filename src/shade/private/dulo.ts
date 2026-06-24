
import type { ScraperPlugin } from "../../lib/nano/plugins-loader";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DULO_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "application/json, text/plain, */*",
  "X-API-Key": "WDNUNBUB3HR983Y9ISBADK4O8",
  Authorization: "Bearer WDNUNBUB3HR983Y9ISBADK4O8",
  Origin: "https://dulo.tv",
};

const DULO_IPS = [
  "129.121.103.59",
  "104.21.67.210",
  "172.67.181.33",
];

async function nodeFetchWithIp(targetUrl: string, ip: string, host: string, options: any = {}): Promise<any> {
  let https: any;
  try { https = await import("node:https"); } catch(e) {}
  return new Promise((resolve, reject) => {
    if (!https) return reject(new Error("no https"));
    try {
      const urlObj = new URL(targetUrl);
      const requestHeaders = { ...options.headers };
      requestHeaders["Host"] = host;
      const reqOptions: any = {
        hostname: ip, port: 443, path: urlObj.pathname + urlObj.search,
        method: options.method || "GET", servername: host,
        headers: requestHeaders, rejectUnauthorized: false,
      };
      const req = https.request(reqOptions, (res) => {
        const chunks: any[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
            status: res.statusCode,
            headers: {
              get(name: string) { const val = res.headers[name.toLowerCase()]; return Array.isArray(val) ? val.join(", ") : (val as string) || null; },
              raw() { return res.headers; },
            },
            json: async () => JSON.parse(buffer.toString("utf8")),
            text: async () => buffer.toString("utf8"),
          });
        });
      });
      req.on("error", (err) => reject(err));
      if (options.signal) { options.signal.addEventListener("abort", () => { req.destroy(); reject(new Error("aborted")); }); }
      req.end();
    } catch (e) { reject(e); }
  });
}

async function smartFetch(url: string, options: any = {}) {
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    for (const ip of DULO_IPS) {
      try {
        const res = await nodeFetchWithIp(url, ip, "dulo.tv", options);
        if (res && res.status === 200) return res;
      } catch {}
    }
  }
  return await fetch(url, options);
}

const plugin: ScraperPlugin = {
  key: "dulo", name: "Dulo.tv", enabled: true, rank: 8, isDirect: true,
  async fetchStream(id, type, season, episode) {
    try {
      const mediaType = type === "tv" ? "tv" : "movie";
      const sessionUrl = "https://dulo.tv/api/session";
      const headers = { ...DULO_HEADERS, Referer: `https://dulo.tv/watch/${mediaType}/${id}` };
      const sessionRes = await smartFetch(sessionUrl, { headers, signal: AbortSignal.timeout(8000) });
      if (!sessionRes || sessionRes.status !== 200) return null;
      let cookieStr = "";
      let setCookieValues: string[] = [];
      if (typeof sessionRes.headers.raw === "function") {
        const raw = sessionRes.headers.raw();
        const cookies = raw["set-cookie"] || raw["Set-Cookie"] || raw["x-proxy-set-cookie"] || raw["X-Proxy-Set-Cookie"];
        if (Array.isArray(cookies)) setCookieValues = cookies;
      }
      if (setCookieValues.length === 0) {
        const singleCookie = sessionRes.headers.get("set-cookie") || sessionRes.headers.get("Set-Cookie") || sessionRes.headers.get("x-proxy-set-cookie") || sessionRes.headers.get("X-Proxy-Set-Cookie");
        if (singleCookie) setCookieValues = [singleCookie];
      }
      if (setCookieValues.length > 0) cookieStr = setCookieValues.map((c: string) => c.split(";")[0]).join("; ");
      let sourcesUrl = `https://dulo.tv/api/sources?tmdb=${id}&smart=1`;
      if (mediaType === "tv") sourcesUrl += `&type=tv&season=${season}&episode=${episode}`;
      const sourcesHeaders: Record<string, string> = { ...headers };
      if (cookieStr) sourcesHeaders["Cookie"] = cookieStr;
      const sourcesRes = await smartFetch(sourcesUrl, { headers: sourcesHeaders, signal: AbortSignal.timeout(8000) });
      if (!sourcesRes || sourcesRes.status !== 200) return null;
      const payload = await sourcesRes.json();
      if (!payload || !Array.isArray(payload.sources) || payload.sources.length === 0) return null;
      const src = payload.sources[0];
      const isM3U8 = src.url.includes(".m3u8") || src.type === "hls";
      const subtitles = Array.isArray(src.subtitles) ? src.subtitles.map((sub: any) => ({ url: sub.url, language: sub.language || "Unknown", label: sub.language || "Unknown", type: sub.format || "vtt" })) : [];
      return { url: src.url, isM3U8, subtitles };
    } catch { return null; }
  },
};

export default plugin;
