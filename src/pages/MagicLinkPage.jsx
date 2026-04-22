import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { jsonApi } from "../api/jsonApi";
import { useAuth } from "../auth/AuthContext";
import FeedbackState from "../components/FeedbackState";
import { getDefaultRoute } from "../rbac/permissions";

function MagicLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [error, setError] = useState(null);
  const token = searchParams.get("token") || "";

  useEffect(() => {
    let isMounted = true;

    async function consume() {
      if (!token) {
        setError(new Error("Magic link token is missing"));
        return;
      }

      try {
        const result = await jsonApi.consumeMagicLink(token);
        await refreshAuth();
        if (isMounted) {
          navigate(getDefaultRoute(result.user), { replace: true });
        }
      } catch (nextError) {
        if (isMounted) {
          setError(nextError);
        }
      }
    }

    consume();

    return () => {
      isMounted = false;
    };
  }, [navigate, refreshAuth, token]);

  if (error) {
    return (
      <FeedbackState
        title="Magic link не сработал"
        description={error.message || "Ссылка недействительна или уже была использована."}
        actionLabel="К регистрации"
        onAction={() => navigate("/register", { replace: true })}
      />
    );
  }

  return (
    <FeedbackState
      title="Открываем вход"
      description="Проверяем одноразовую ссылку и готовим ваш кабинет."
    />
  );
}

export default MagicLinkPage;
