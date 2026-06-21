import { fetchVidzee } from "./vidzee";
import { getPlugins } from "./plugins-loader";

export type StreamResult = {
  url: string;
  isDirect: boolean;
  isM3U8: boolean;
  subtitles: Array<{ src: string; label: string; language: string }>;
};

export async function resolveStream(
  providerId: string,
  id: string,
  type: string,
  season?: string,
  episode?: string
): Promise<StreamResult> {
  if (providerId === "vidzeeWorks") {
    const stream = await fetchVidzee(id, season, episode);
    if (!stream) return { url: "", isDirect: false, isM3U8: false, subtitles: [] };
    return { url: stream.url, isDirect: true, isM3U8: stream.isM3U8, subtitles: [] };
  }

  const plugins = getPlugins();
  const plugin = plugins.find((p) => p.key === providerId);
  if (plugin && plugin.enabled) {
    try {
      const stream = await plugin.fetchStream(id, type, season, episode);
      if (stream) {
        return { url: stream.url, isDirect: plugin.isDirect, isM3U8: stream.isM3U8, subtitles: stream.subtitles || [] };
      }
    } catch (e) {
    }
  }

  return { url: "", isDirect: false, isM3U8: false, subtitles: [] };
}
