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

function PodcastPlayer({ podcast }) {
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
      <audio controls preload="none" src={podcast.audioUrl}>
        <track kind="captions" />
        Ваш браузер не поддерживает воспроизведение аудио.
      </audio>
    </article>
  );
}

export default PodcastPlayer;
