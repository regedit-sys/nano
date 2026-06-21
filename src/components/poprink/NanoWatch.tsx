import { useState, useEffect } from "react"
import VidstackPlayer from "./video-player/vidstack-player"
import Player from "./video-player/player"
import Controls from "./video-player/controls"
import Settings from "./video-player/settings"
import "./nano.css"
import { providerList } from "../../lib/nano/nano.poprink"
import { poprinkConfig } from "./config.poprink"
import { TRANSLATIONS } from "./locales/translations"

interface NanoWatchProps {
  id: string
  type: string
  season?: string
  episode?: string
}

interface MediaInfo {
  title: string
  overview: string
  poster?: string
  backdrop?: string
  seasons?: SeasonInfo[]
}

interface SeasonInfo {
  season_number: number
  episode_count: number
  name: string
}

interface EpisodeInfo {
  episode_number: number
  name: string
}

const SERVERS = providerList
  .filter((p) => p.enabled)
  .map((p) => ({ id: p.key, name: p.name }))

export default function NanoWatch({ id, type, season, episode }: NanoWatchProps) {
  const [locale, setLocale] = useState(poprinkConfig.metadata.defaultLocale || "en")
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([])
  const [currentSeason, setCurrentSeason] = useState(Number(season) || 1)
  const [currentEpisode, setCurrentEpisode] = useState(Number(episode) || 1)
  const [activeServer, setActiveServer] = useState(() => {
    const enabled = providerList.filter((p) => p.enabled)
    const custom = enabled.find((p) => p.key !== "vidzeeWorks")
    if (custom) return custom.key
    return poprinkConfig.features.videoPlayer.defaultServer || (enabled.length > 0 ? enabled[0].key : "vidzee")
  })
  const [playerUrl, setPlayerUrl] = useState("")
  const [isDirectPlayer, setIsDirectPlayer] = useState(false)
  const [isM3U8, setIsM3U8] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showEpisodes, setShowEpisodes] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [subtitles, setSubtitles] = useState<any[]>([])
  const playerType = poprinkConfig.features.videoPlayer.useVidstack ? "vidstack" : "default"

  useEffect(() => {
    const saved = localStorage.getItem("poprink-locale")
    if (saved) setLocale(saved)
  }, [])

  const messages = ["poprink", TRANSLATIONS[locale]?.searching || "searching", TRANSLATIONS[locale]?.loading || "loading"]

  useEffect(() => {
    if (!loading && !scraping) return
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [loading, scraping, messages.length])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/details?id=${id}&type=${type}`)
        if (cancelled) return
        const data = await res.json()
        
        if (data.blocked || data.adult === true) {
          setBlocked(true)
          setLoading(false)
          return
        }
        
        const seasons = Array.isArray(data.seasons) ? data.seasons : []
        setInfo({
          title: data.title || data.name || "",
          overview: data.overview || "",
          poster: data.poster_path || data.poster || "",
          backdrop: data.backdrop_path || data.backdrop || "",
          seasons: seasons
            .filter((s: any) => s.season_number > 0)
            .map((s: any) => ({
              season_number: s.season_number,
              episode_count: s.episode_count,
              name: s.name,
            })),
        })
        setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, type])

  useEffect(() => {
    if (!info?.title || !poprinkConfig.features.enableContinueWatching) return
    const saved = localStorage.getItem("poprink-continue-watching")
    let list = saved ? JSON.parse(saved) : []
    const watchItem = {
      id: Number(id),
      type,
      title: info.title,
      poster_path: info.poster || null,
      season: type === "tv" ? currentSeason : undefined,
      episode: type === "tv" ? currentEpisode : undefined,
      updatedAt: new Date().getTime(),
    }
    list = list.filter((item: any) => !(item.id === watchItem.id && item.type === watchItem.type))
    list.unshift(watchItem)
    list = list.slice(0, 12)
    localStorage.setItem("poprink-continue-watching", JSON.stringify(list))
  }, [id, type, info, currentSeason, currentEpisode])

  useEffect(() => {
    if (type !== "tv") return
    let cancelled = false
    async function loadEpisodes() {
      try {
        const res = await fetch(`/api/details?id=${id}&type=tv&season=${currentSeason}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const epList = Array.isArray(data.episodes) ? data.episodes : []
        setEpisodes(
          epList.map((ep: any) => ({
            episode_number: ep.episode_number,
            name: ep.name || "",
          }))
        )
      } catch {
        if (!cancelled) setEpisodes([])
      }
    }
    loadEpisodes()
    return () => {
      cancelled = true
    }
  }, [id, currentSeason, type])

  useEffect(() => {
    let cancelled = false
    async function fetchScraped() {
      setScraping(true)
      try {
        const res = await fetch(`/api/scrape?id=${id}&type=${type}&season=${currentSeason}&episode=${currentEpisode}&provider=${activeServer}`)
        if (cancelled) return
        if (!res.ok) {
          setPlayerUrl("")
          setIsDirectPlayer(false)
          setIsM3U8(false)
          setScraping(false)
          return
        }
        const data = await res.json()
        setPlayerUrl(data.url)
        setIsDirectPlayer(data.isDirect || false)
        setIsM3U8(data.isM3U8 || false)
        setSubtitles(data.subtitles || [])
        setScraping(false)
      } catch {
        if (!cancelled) {
          setPlayerUrl("")
          setIsDirectPlayer(false)
          setIsM3U8(false)
          setSubtitles([])
          setScraping(false)
        }
      }
    }
    fetchScraped()
    return () => {
      cancelled = true
    }
  }, [id, type, currentSeason, currentEpisode, activeServer])

  const handleEpisodeSelect = (epNum: number) => {
    setCurrentEpisode(epNum)
    window.history.replaceState(null, "", `/watch/${id}?type=tv&season=${currentSeason}&episode=${epNum}`)
  }

  const handleSeasonChange = (seasonNum: number) => {
    setCurrentSeason(seasonNum)
    setCurrentEpisode(1)
    window.history.replaceState(null, "", `/watch/${id}?type=tv&season=${seasonNum}&episode=1`)
  }

  if (loading || scraping) {
    const posterUrl = info?.poster
      ? `https://image.tmdb.org/t/p/w500${info.poster}`
      : ""
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
      }}>
        {posterUrl && (
          <>
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${posterUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center center",
              backgroundRepeat: "no-repeat",
              opacity: 0.3,
              filter: "blur(20px)",
              transform: "scale(1.1)",
              zIndex: 0,
            }} />
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(10,10,12,0.6) 0%, rgba(10,10,12,0.95) 100%)",
              zIndex: 1,
            }} />
          </>
        )}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
          <h1 
            className="nano-shimmer-text"
            style={{
              fontSize: "3.5rem",
              fontWeight: 900,
              letterSpacing: "-0.05em",
              textTransform: "lowercase",
              margin: 0,
            }}
          >
            {messages[msgIndex]}
          </h1>
        </div>
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="tvko-loading" style={{ flexDirection: "column", gap: "20px" }}>
        <div style={{ fontSize: "48px" }}>🚫</div>
        <div style={{ fontSize: "24px", fontWeight: "bold" }}>Content Blocked</div>
        <div style={{ fontSize: "16px", opacity: 0.7, maxWidth: "400px", textAlign: "center" }}>
          This content has been blocked due to adult content restrictions.
        </div>
        <button 
          onClick={() => window.location.href = "/"} 
          style={{ 
            marginTop: "20px", 
            padding: "12px 24px", 
            fontSize: "16px", 
            backgroundColor: "hsl(var(--theme-hue), 70%, 50%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer"
          }}
        >
          Go Back Home
        </button>
      </div>
    )
  }

  if (!playerUrl) {
    return (
      <div className="tvko-loading">
        <div style={{ color: '#fff', fontSize: '18px' }}>No stream available</div>
      </div>
    )
  }

  const displayTitle =
    type === "tv"
      ? `${info?.title || ""} - Season ${currentSeason} Episode ${currentEpisode}`
      : info?.title || ""

  return (
    <div className="nano-watch-wrapper" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <Controls
        displayTitle={displayTitle}
        servers={SERVERS}
        activeServer={activeServer}
        setActiveServer={setActiveServer}
        isTv={type === "tv"}
        showEpisodes={showEpisodes}
        setShowEpisodes={setShowEpisodes}
      />

      <div className="nano-watch-content" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {playerType === "vidstack" ? (
          <VidstackPlayer
            embedUrl={playerUrl}
            isDirect={isDirectPlayer}
            isM3U8={isM3U8}
            title={displayTitle}
            subtitles={subtitles}
          />
        ) : (
          <Player
            embedUrl={playerUrl}
            isDirect={isDirectPlayer}
            isM3U8={isM3U8}
            title={displayTitle}
            servers={SERVERS}
            activeServer={activeServer}
            setActiveServer={setActiveServer}
            isTv={type === "tv"}
            showEpisodes={showEpisodes}
            setShowEpisodes={setShowEpisodes}
          />
        )}
        {type === "tv" && showEpisodes && (
          <Settings
            info={info}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            episodes={episodes}
            handleSeasonChange={handleSeasonChange}
            handleEpisodeSelect={handleEpisodeSelect}
          />
        )}
      </div>
    </div>
  )
}
