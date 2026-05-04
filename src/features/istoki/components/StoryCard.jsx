function StoryCard({ story }) {
  return (
    <article className="istoki-story">
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
