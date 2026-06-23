export interface ScraperPlugin {
  key: string;
  name: string;
  enabled: boolean;
  rank: number;
  isDirect: boolean;
  fetchStream: (id: string, type: string, season?: string, episode?: string) => Promise<{ url: string; isM3U8: boolean; subtitles?: Array<{ src: string; label: string; language: string }> } | null>;
}

export function getPlugins(): ScraperPlugin[] {
  const plugins: ScraperPlugin[] = [];
  try {
    const modules = import.meta.glob('/src/shade/**/*.ts', { eager: true });
    for (const path in modules) {
      if (path.includes('placeholder.ts')) continue;
      const mod = modules[path] as any;
      if (mod && mod.default) {
        if (Array.isArray(mod.default)) {
          plugins.push(...mod.default);
        } else {
          plugins.push(mod.default);
        }
      }
    }
  } catch (e) {
  }
  return plugins;
}
