import { useEffect, useRef } from "react";
import { useIstokiTracking } from "../useIstokiTracking";

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} мин ${seconds.toString().padStart(2, "0")} сек`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function PodcastPlayer({ podcast, regionCode }) {
  const { track } = useIstokiTracking();
  const audioRef = useRef(null);
  const playedOnceRef = useRef(false);
  const lastReportedSecRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    function handlePlay() {
      if (playedOnceRef.current) return;
      playedOnceRef.current = true;
      track({
        type: "podcast.played",
        regionCode,
        entityId: podcast.id,
      });
    }

    function handleTimeUpdate() {
      const listened = Math.floor(audio.currentTime);
      // Report every 30s of listened time, deduplicated by integer step.
      if (listened - lastReportedSecRef.current < 30) return;
      lastReportedSecRef.current = listened;
      track({
        type: "podcast.progress",
        regionCode,
        entityId: podcast.id,
        payload: { listenedSec: listened, durationSec: podcast.durationSec },
      });
    }

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [podcast.id, podcast.durationSec, regionCode, track]);

  return (
    <article className="istoki-podcast">
      <div className="istoki-podcast-meta">
        <span>{formatDate(podcast.recordedAt)}</span>
        <span className="istoki-podcast-meta-dot" aria-hidden="true" />
        <span>{formatDuration(podcast.durationSec)}</span>
        {podcast.speakerName && (
          <>
            <span className="istoki-podcast-meta-dot" aria-hidden="true" />
            <span>{podcast.speakerName}</span>
          </>
        )}
      </div>
      <h3 className="istoki-podcast-title">{podcast.title}</h3>
      <p className="istoki-podcast-desc">{podcast.description}</p>
      <audio ref={audioRef} controls preload="none" src={podcast.audioUrl}>
        <track kind="captions" />
        Ваш браузер не поддерживает воспроизведение аудио.
      </audio>
    </article>
  );
}

export default PodcastPlayer;
