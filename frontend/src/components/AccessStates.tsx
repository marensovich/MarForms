// src/components/AccessStates.tsx
import { motion } from "framer-motion";
import { loginWithDiscord } from "../api/auth";
import { saveRedirectPath } from "../auth/redirectStorage";
import { BackgroundGlow } from "./LoadingScreen";
import {FaDiscord} from "react-icons/fa";
import {SiDiscord} from "react-icons/si";
import {AiFillDiscord} from "react-icons/ai";
import {BsDiscord} from "react-icons/bs";

interface Props {
  formId?: string;
}

const cardClass =
  "relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10";

const wrapperClass =
  "relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0f] px-4";

function StateCard({ children }: { children: React.ReactNode }) {
  return (
    <div className={wrapperClass}>
      <BackgroundGlow />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={cardClass}
      >
        {children}
      </motion.div>
    </div>
  );
}

function Logo() {
  return (
    <div className="mb-5 flex justify-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/30">
        MF
      </div>
    </div>
  );
}

export function NotAuthenticatedState({ formId }: Props) {
  const handleLogin = () => {
    if (formId) saveRedirectPath(`/forms/${formId}`);
    loginWithDiscord();
  };

  return (
    <StateCard>
      <Logo />
      <h1 className="text-2xl font-semibold text-white">Sign in required</h1>
      <p className="mt-2 text-sm text-white/50">
        This form requires you to sign in with Discord before you can continue.
      </p>
      <motion.button
        onClick={handleLogin}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-6 py-3.5 font-medium text-white shadow-lg shadow-[#5865F2]/25 transition-colors hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
      >
        <BsDiscord />
        Login with Discord
      </motion.button>
      <p className="mt-4 text-xs text-white/30">
        You&apos;ll be redirected back to this form after signing in.
      </p>
    </StateCard>
  );
}

export function NotInGuildState() {
  return (
    <StateCard>
      <Logo />
      <div className="mb-4 text-3xl">🔒</div>
      <h1 className="text-2xl font-semibold text-white">Access denied</h1>
      <p className="mt-2 text-sm text-white/50">
        You are not a member of the Discord server this form is linked to. Join
        the server and try again.
      </p>
    </StateCard>
  );
}

export function FormInactiveState() {
  return (
    <StateCard>
      <Logo />
      <div className="mb-4 text-3xl">📭</div>
      <h1 className="text-2xl font-semibold text-white">
        Form is no longer available
      </h1>
      <p className="mt-2 text-sm text-white/50">
        This form has been closed and is not accepting new responses.
      </p>
    </StateCard>
  );
}

export function FormNotFoundState() {
  return (
    <StateCard>
      <Logo />
      <div className="mb-4 text-3xl">🔍</div>
      <h1 className="text-2xl font-semibold text-white">Form not found</h1>
      <p className="mt-2 text-sm text-white/50">
        This link is invalid or the form has been deleted.
      </p>
    </StateCard>
  );
}

export function FormErrorState() {
  return (
    <StateCard>
      <Logo />
      <div className="mb-4 text-3xl">⚠️</div>
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mt-2 text-sm text-white/50">
        Could not load the form. Please try again later.
      </p>
    </StateCard>
  );
}
