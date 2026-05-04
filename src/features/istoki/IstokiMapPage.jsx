import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import RussiaMap from "./components/RussiaMap";
import RegionPortalDrawer from "./components/RegionPortalDrawer";
import regionsData from "./data/regions.json";

const REGIONS = Object.fromEntries(regionsData.map((region) => [region.code, region]));

function IstokiMapPage({ deepLink = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!deepLink) return;
    const code = params.regionCode;
    if (code && REGIONS[code]) {
      navigate(`/istoki/map?region=${code}`, { replace: true });
    } else {
      navigate("/istoki/map", { replace: true });
    }
  }, [deepLink, params.regionCode, navigate]);

  const activeCode = searchParams.get("region");
  const activeRegion = useMemo(() => (activeCode ? REGIONS[activeCode] : null), [activeCode]);

  function handleSelect(code) {
    setSearchParams({ region: code });
  }

  function handleClose() {
    setSearchParams({});
  }

  return (
    <main>
      <section className="istoki-hero">
        <span className="istoki-hero-eyebrow">Голоса регионов</span>
        <h1 className="istoki-hero-title">
          Карта <em>истóков</em>
        </h1>
        <p className="istoki-hero-lead">
          Это не статистика присутствия — это живой архив человеческого опыта. Выберите регион,
          чтобы услышать голоса участников, прочитать истории трансформации и увидеть летопись
          заездов, которая там состоялась.
        </p>
      </section>

      <RussiaMap activeCode={activeCode} onRegionSelect={handleSelect} />

      {activeRegion && <RegionPortalDrawer region={activeRegion} onClose={handleClose} />}
    </main>
  );
}

export default IstokiMapPage;
