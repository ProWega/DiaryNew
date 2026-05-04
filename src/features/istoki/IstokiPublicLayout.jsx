import { useEffect } from "react";

function IstokiPublicLayout({ children }) {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="istoki-shell" data-istoki-theme>
      <header className="istoki-header">
        <div className="istoki-wordmark">
          <span>истóки</span>
          <span className="istoki-wordmark-sub">голоса регионов</span>
        </div>
        <div className="istoki-tagline">проект от росмолодёжи</div>
      </header>
      {children}
    </div>
  );
}

export default IstokiPublicLayout;
