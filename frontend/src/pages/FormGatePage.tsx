// src/pages/FormGatePage.tsx
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { loginWithDiscord } from "../api/auth";
import { saveRedirectPath } from "../auth/redirectStorage";
import LoadingScreen from "../components/LoadingScreen";
import { BackgroundGlow } from "../components/LoadingScreen";
import { motion } from "framer-motion";

export default function FormGatePage() {
  const { formId } = useParams<{ formId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      // уже авторизован — реальный рендер формы берёт на себя FormPage,
      // этот компонент отвечает только за gate-логику
      return;
    }
  }, [loading, user]);

  if (loading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (user) {
    return <FormPlaceholder formId={formId} />;
  }

  const handleLogin = () => {
    if (formId) {
      saveRedirectPath(`/forms/${formId}`);
    }
    loginWithDiscord();
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0f] px-4">
      <BackgroundGlow />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl sm:p-10"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/30">
            MF
          </div>
          <h1 className="text-2xl font-semibold text-white">Sign in required</h1>
          <p className="mt-2 text-sm text-white/50">
            This form requires you to sign in with Discord before you can
            continue.
          </p>
        </div>

        <motion.button
          onClick={handleLogin}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-6 py-3.5 font-medium text-white shadow-lg shadow-[#5865F2]/25 transition-colors duration-200 hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
        >
          <DiscordIcon />
          Login with Discord
        </motion.button>

        <p className="mt-6 text-center text-xs text-white/30">
          You&apos;ll be redirected back to this form after signing in.
        </p>
      </motion.div>
    </div>
  );
}

function FormPlaceholder({ formId }: { formId?: string }) {
  // сюда позже подключается реальный FormRenderer с GET /api/forms/{formId}
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
      <p>Form {formId} loads here.</p>
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369A19.791 19.791 0 0 0 16.558 3c-.165.292-.359.687-.49.999a18.27 18.27 0 0 0-4.137 0A8.062 8.062 0 0 0 11.44 3a19.736 19.736 0 0 0-3.76 1.369C4.4 8.846 3.55 13.207 3.97 17.5a19.93 19.93 0 0 0 5.993 3.03c.483-.659.913-1.358 1.282-2.094a12.84 12.84 0 0 1-2.02-.97c.17-.124.336-.253.497-.387a14.13 14.13 0 0 0 12.557 0c.163.134.328.263.497.387-.642.382-1.317.708-2.02.97.37.736.8 1.435 1.282 2.094a19.876 19.876 0 0 0 5.995-3.03c.5-4.953-.838-9.279-3.667-13.131ZM9.736 14.945c-1.183 0-2.157-1.085-2.157-2.418 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.417-2.157 2.417Zm6.528 0c-1.183 0-2.157-1.085-2.157-2.418 0-1.333.955-2.419 2.157-2.419 1.211 0 2.175 1.095 2.157 2.42 0 1.332-.937 2.417-2.157 2.417Z" />
    </svg>
  );
}