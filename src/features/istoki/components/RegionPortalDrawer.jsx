import { useEffect, useState } from "react";
import PodcastPlayer from "./PodcastPlayer";
import StoryCard from "./StoryCard";
import ChronicleTimeline from "./ChronicleTimeline";
import { useIstokiTracking } from "../useIstokiTracking";

const TABS = [
  { id: "voice", label: "Голос региона" },
  { id: "stories", label: "Личные истории" },
  { id: "chronicle", label: "Цифровая летопись" },
];

function RegionPortalDrawer({ region, onClose }) {
  const [activeTab, setActiveTab] = useState("voice");
  const { track } = useIstokiTracking();

  useEffect(() => {
    setActiveTab("voice");
    if (region?.code) {
      track({ type: "region.opened", regionCode: region.code });
    }
  }, [region?.code, track]);

  useEffect(() => {
    if (!region?.code) return;
    if (activeTab === "chronicle") {
      track({ type: "chronicle.viewed", regionCode: region.code });
    }
  }, [activeTab, region?.code, track]);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!region) return null;

  return (
    <>
      <div className="istoki-drawer-backdrop" onClick={onClose} />
      <aside
        className="istoki-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="istoki-drawer-title"
      >
        <div className="istoki-drawer-head">
          <button
            type="button"
            className="istoki-drawer-close"
            onClick={onClose}
            aria-label="Закрыть портал региона"
          >
            ✕
          </button>
          <div className="istoki-drawer-eyebrow">Портал региона</div>
          <h2 id="istoki-drawer-title" className="istoki-drawer-title">
            {region.name}
          </h2>
          <div className="istoki-drawer-hint">{region.geographicHint}</div>
        </div>

        <div className="istoki-drawer-tabs" role="tablist" aria-label="Разделы портала">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="istoki-drawer-tab"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="istoki-drawer-body" role="tabpanel">
          {activeTab === "voice" &&
            (region.podcasts.length ? (
              region.podcasts.map((podcast) => (
                <PodcastPlayer key={podcast.id} podcast={podcast} regionCode={region.code} />
              ))
            ) : (
              <div className="istoki-empty">Подкасты этого региона ещё в работе.</div>
            ))}

          {activeTab === "stories" &&
            (region.stories.length ? (
              region.stories.map((story) => (
                <StoryCard key={story.id} story={story} regionCode={region.code} />
              ))
            ) : (
              <div className="istoki-empty">Истории этого региона ещё собираются.</div>
            ))}

          {activeTab === "chronicle" && <ChronicleTimeline entries={region.chronicle} />}
        </div>
      </aside>
    </>
  );
}

export default RegionPortalDrawer;
