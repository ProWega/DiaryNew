import { useEffect, useRef } from "react";
import { useIstokiTracking } from "../useIstokiTracking";

function StoryCard({ story, regionCode }) {
  const { track } = useIstokiTracking();
  const ref = useRef(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current || !ref.current) return undefined;
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Count a "view" only when at least half the card is visible —
          // avoids double-counting cards merely scrolled past.
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (reportedRef.current) return;
            reportedRef.current = true;
            track({ type: "story.viewed", regionCode, entityId: story.id });
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [story.id, regionCode, track]);

  return (
    <article ref={ref} className="istoki-story">
      <img
        className="istoki-story-photo"
        src={story.photoUrl}
        alt={`${story.participantName} — портрет участника`}
        loading="lazy"
      />
      <div className="istoki-story-body">
        <div>
          <h3 className="istoki-story-name">{story.participantName}</h3>
          <div className="istoki-story-role">{story.ageOrRole}</div>
          {story.regionContextHint && (
            <div className="istoki-story-context">{story.regionContextHint}</div>
          )}
        </div>

        <div className="istoki-story-bivariant">
          <div className="istoki-story-side">
            <span className="istoki-story-side-label">До</span>
            <p className="istoki-story-side-text">{story.beforeText}</p>
          </div>
          <div className="istoki-story-side">
            <span className="istoki-story-side-label">После</span>
            <p className="istoki-story-side-text">{story.afterText}</p>
          </div>
        </div>

        <blockquote className="istoki-story-quote">
          <span className="istoki-story-quote-text">{story.manifestoQuote}</span>
        </blockquote>
      </div>
    </article>
  );
}

export default StoryCard;
