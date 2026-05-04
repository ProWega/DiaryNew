import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import RussiaMap from "./components/RussiaMap";
import RegionPortalDrawer from "./components/RegionPortalDrawer";
import { useIstokiRegion, useIstokiRegions } from "./api";

function IstokiMapPage({ deepLink = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();

  const regionsQuery = useIstokiRegions();
  const regions = regionsQuery.data?.regions ?? [];
  const regionCodes = useMemo(() => new Set(regions.map((r) => r.code)), [regions]);

  useEffect(() => {
    if (!deepLink) return;
    const code = params.regionCode;
    if (regionsQuery.isLoading) return;
    if (code && regionCodes.has(code)) {
      navigate(`/istoki/map?region=${code}`, { replace: true });
    } else {
      navigate("/istoki/map", { replace: true });
    }
  }, [deepLink, params.regionCode, navigate, regionsQuery.isLoading, regionCodes]);

  const activeCode = searchParams.get("region");
  const regionDetailQuery = useIstokiRegion(activeCode);
  const activeRegion = regionDetailQuery.data ?? null;

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

      {regionsQuery.isError ? (
        <div className="istoki-empty" style={{ padding: "60px 16px" }}>
          Не удалось загрузить регионы. Попробуйте обновить страницу.
        </div>
      ) : (
        <RussiaMap
          activeCode={activeCode}
          onRegionSelect={handleSelect}
          regions={regions}
          isLoading={regionsQuery.isLoading}
        />
      )}

      {activeCode && activeRegion && (
        <RegionPortalDrawer region={activeRegion} onClose={handleClose} />
      )}
    </main>
  );
}

export default IstokiMapPage;
