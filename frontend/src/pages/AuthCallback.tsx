import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { consumeRedirectPath } from "../auth/redirectStorage";
import LoadingScreen from "../components/LoadingScreen";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const token = searchParams.get("token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    // login теперь async — ждём /me перед редиректом
    login(token).then(() => {
      const redirectPath = consumeRedirectPath();
      navigate(redirectPath ?? "/", { replace: true });
    });
  }, [searchParams, login, navigate]);

  return <LoadingScreen label="Signing you in..." />;
}