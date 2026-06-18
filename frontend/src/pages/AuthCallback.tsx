import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoadingScreen from "../components/LoadingScreen";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { finalizeLogin } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const token = searchParams.get("token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    finalizeLogin(token);

    const redirectTimer = setTimeout(() => {
      navigate("/", { replace: true });
    }, 600);

    return () => clearTimeout(redirectTimer);
  }, [searchParams, finalizeLogin, navigate]);

  return <LoadingScreen label="Signing you in..." />;
}