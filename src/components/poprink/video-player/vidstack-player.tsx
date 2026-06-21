import { useEffect, useRef, useState } from "react";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import { defaultLayoutIcons, DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { FaCheck, FaServer } from "react-icons/fa";
import { HiMiniRectangleStack } from "react-icons/hi2";
import { FiX } from "react-icons/fi";

interface VidstackPlayerProps {
  embedUrl: string;
  isDirect: boolean;
  isM3U8?: boolean;
  title?: string;
  servers?: Array<{ id: string; name: string }>;
  activeServer?: string;
  setActiveServer?: (server: string) => void;
  isTv?: boolean;
  showEpisodes?: boolean;
  setShowEpisodes?: (show: boolean) => void;
  info?: any;
  currentSeason?: number;
  currentEpisode?: number;
  episodes?: any[];
  handleSeasonChange?: (seasonNum: number) => void;
  handleEpisodeSelect?: (epNum: number) => void;
  subtitles?: any[];
}

export default function VidstackPlayer({
  embedUrl,
  isDirect,
  isM3U8 = false,
  title,
  servers = [],
  activeServer = "",
  setActiveServer,
  isTv = false,
  info,
  currentSeason = 1,
  currentEpisode = 1,
  episodes = [],
  handleSeasonChange,
  handleEpisodeSelect,
  subtitles = [],
}: VidstackPlayerProps) {
  const playerRef = useRef<any>(null);
  const serverRef = useRef<HTMLDivElement>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [localShowEpisodes, setLocalShowEpisodes] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (serverRef.current && !serverRef.current.contains(e.target as Node)) {
        setServerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isDirect) {
    return (
      <div className="nano-player-wrapper" style={{ flex: 1, position: "relative", paddingTop: "70px" }}>
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      </div>
    );
  }

  const activeServerName = servers.find((s) => s.id === activeServer)?.name || activeServer;

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#000" }}
    >
      <MediaPlayer
        ref={playerRef}
        title={title || "Video"}
        src={isM3U8 ? { src: embedUrl, type: "application/x-mpegurl" } : embedUrl}
        crossOrigin
        playsInline
        autoplay
        onCanPlay={() => {
          playerRef.current?.play().catch(() => {});
        }}
        style={{ width: "100%", height: "100%", "--video-brand": "var(--accent-color)" } as any}
      >
        <MediaProvider>
          {subtitles.map((track, index) => (
            <track
              key={index}
              src={track.src}
              label={track.label}
              srcLang={track.language || track.srclang}
              kind="subtitles"
              default={track.default}
            />
          ))}
        </MediaProvider>
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          thumbnails=""
        />

        <div style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          opacity: isHovered || serverOpen || localShowEpisodes ? 1 : 0,
          transition: "opacity 0.2s ease-in-out",
          pointerEvents: isHovered || serverOpen || localShowEpisodes ? "auto" : "none",
        }}>
          {isTv && handleSeasonChange && handleEpisodeSelect && (
            <button
              onClick={() => setLocalShowEpisodes(!localShowEpisodes)}
              style={{
                borderRadius: "8px",
                height: "36px",
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                backgroundColor: localShowEpisodes ? "var(--accent-color)" : "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <HiMiniRectangleStack style={{ fontSize: "15px", color: localShowEpisodes ? "#000" : "#fff" }} />
              <span style={{ color: localShowEpisodes ? "#000" : "#fff" }}>Episodes</span>
            </button>
          )}

          {servers.length > 0 && setActiveServer && (
            <div ref={serverRef} style={{ position: "relative" }}>
              <button
                onClick={() => setServerOpen(!serverOpen)}
                style={{
                  borderRadius: "8px",
                  height: "36px",
                  padding: "0 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#fff",
                  backgroundColor: serverOpen ? "var(--accent-color)" : "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                <FaServer style={{ fontSize: "13px", color: serverOpen ? "#000" : "#fff" }} />
                <span style={{ color: serverOpen ? "#000" : "#fff" }}>{activeServerName}</span>
              </button>

              {serverOpen && (
                <div style={{
                  position: "absolute",
                  top: "42px",
                  right: 0,
                  backgroundColor: "rgba(10, 10, 12, 0.95)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  padding: "4px",
                  minWidth: "130px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                }}>
                  {servers.map((server) => (
                    <button
                      key={server.id}
                      onClick={() => {
                        setActiveServer(server.id);
                        setServerOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "none",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                      <span style={{ fontWeight: server.id === activeServer ? 600 : 400 }}>{server.name}</span>
                      {server.id === activeServer && <FaCheck style={{ fontSize: "10px", color: "var(--accent-color)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {isTv && localShowEpisodes && info?.seasons && handleSeasonChange && handleEpisodeSelect && (
          <div style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "300px",
            background: "rgba(10, 10, 12, 0.95)",
            backdropFilter: "blur(12px)",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            zIndex: 110,
            boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: "16px" }}>Episodes</span>
              <button 
                onClick={() => setLocalShowEpisodes(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255,255,255,0.05)"
                }}
              >
                <FiX />
              </button>
            </div>
            
            <select
              value={currentSeason}
              onChange={(e) => handleSeasonChange(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#1f1f23",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                color: "#fff",
                outline: "none",
                fontSize: "14px",
                marginBottom: "16px",
                cursor: "pointer"
              }}
            >
              {info.seasons.map((s: any) => (
                <option key={s.season_number} value={s.season_number}>
                  {s.name}
                </option>
              ))}
            </select>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {episodes.map((ep) => (
                <button
                  key={ep.episode_number}
                  onClick={() => handleEpisodeSelect(ep.episode_number)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "start",
                    padding: "8px 12px",
                    background: ep.episode_number === currentEpisode ? "var(--accent-color)" : "rgba(255,255,255,0.03)",
                    color: ep.episode_number === currentEpisode ? "#000" : "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (ep.episode_number !== currentEpisode) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (ep.episode_number !== currentEpisode) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>Episode {ep.episode_number}</span>
                  <span style={{
                    fontSize: "11px",
                    opacity: ep.episode_number === currentEpisode ? 0.8 : 0.6,
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    width: "100%",
                    marginTop: "2px"
                  }}>
                    {ep.name || `Episode ${ep.episode_number}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </MediaPlayer>
    </div>
  );
}
