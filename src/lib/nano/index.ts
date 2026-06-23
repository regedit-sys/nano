import { fetchVidzee } from "./vidzee";
import { getPlugins } from "./plugins-loader";

export type StreamResult = {
  url: string;
  isDirect: boolean;
  isM3U8: boolean;
  subtitles: Array<{ src: string; label: string; language: string }>;
};

function makeProxyUrl(targetUrl: string, referer: string, origin: string): string {
  const params = new URLSearchParams();
  params.set("url", targetUrl);
  if (referer) params.set("referer", referer);
  if (origin) params.set("origin", origin);
  params.set("userAgent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  return `/api/proxy?${params.toString()}`;
}

export async function resolveStream(
  providerId: string,
  id: string,
  type: string,
  season?: string,
  episode?: string
): Promise<StreamResult> {
  const s = type === "tv" ? season : undefined;
  const e = type === "tv" ? episode : undefined;

  if (providerId === "vidzeeWorks") {
    const stream = await fetchVidzee(id, s, e);
    if (!stream) return { url: "", isDirect: false, isM3U8: false, subtitles: [] };
    return { url: stream.url, isDirect: true, isM3U8: stream.isM3U8, subtitles: [] };
  }

  const plugins = getPlugins();
  const plugin = plugins.find((p) => p.key === providerId);
  if (plugin && plugin.enabled) {
    try {
      const stream = await plugin.fetchStream(id, type, s, e);
      if (stream) {
        let streamUrl = stream.url;
        if (plugin.isDirect) {
          let referer = "";
          let origin = "";
          if (providerId === "vidlink") {
            referer = "https://vidlink.pro/";
            origin = "https://vidlink.pro";
          } else if (providerId === "vidrock") {
            referer = "https://vidrock.ru/";
            origin = "https://vidrock.ru";
          } else if (providerId === "vidcore") {
            referer = "https://vidcore.net/";
            origin = "https://vidcore.net";
          } else if (providerId === "videasy") {
            referer = "https://player.videasy.to/";
            origin = "https://player.videasy.to";
          } else if (providerId === "peachify" || providerId.startsWith("peachify_")) {
            referer = "https://peachify.top/";
            origin = "https://peachify.top";
          } else if (providerId === "dulo" || providerId.startsWith("dulo_")) {
            referer = "https://dulo.tv/";
            origin = "https://dulo.tv";
          }
          if (referer || origin) {
            streamUrl = makeProxyUrl(streamUrl, referer, origin);
          }
        }

        const subtitles = (stream.subtitles || []).map((sub: any) => {
          let subUrl = sub.src || sub.url || "";
          if (subUrl && plugin.isDirect) {
            let referer = "";
            let origin = "";
            if (providerId === "vidlink") {
              referer = "https://vidlink.pro/";
              origin = "https://vidlink.pro";
            } else if (providerId === "vidrock") {
              referer = "https://vidrock.ru/";
              origin = "https://vidrock.ru";
            } else if (providerId === "vidcore") {
              referer = "https://vidcore.net/";
              origin = "https://vidcore.net";
            } else if (providerId === "videasy") {
              referer = "https://player.videasy.to/";
              origin = "https://player.videasy.to";
            } else if (providerId === "peachify" || providerId.startsWith("peachify_")) {
              referer = "https://peachify.top/";
              origin = "https://peachify.top";
            } else if (providerId === "dulo" || providerId.startsWith("dulo_")) {
              referer = "https://dulo.tv/";
              origin = "https://dulo.tv";
            }
            if (referer || origin) {
              subUrl = makeProxyUrl(subUrl, referer, origin);
            }
          }
          return { src: subUrl, label: sub.label || "Subtitle", language: sub.language || sub.lang || "en" };
        });

        return { url: streamUrl, isDirect: plugin.isDirect, isM3U8: stream.isM3U8, subtitles };
      }
    } catch (e) {
    }
  }

  return { url: "", isDirect: false, isM3U8: false, subtitles: [] };
}
