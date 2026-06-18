import { motion } from "framer-motion";
import { loginWithDiscord } from "../api/auth";
import { BackgroundGlow } from "../components/LoadingScreen";
import { FaDiscord } from "react-icons/fa";

export default function LoginPage() {
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
          <h1 className="text-2xl font-semibold text-white">Welcome to MarForms</h1>
          <p className="mt-2 text-sm text-white/50">
            Sign in to continue building and managing your forms.
          </p>
        </div>

        <motion.button
          onClick={loginWithDiscord}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-6 py-3.5 font-medium text-white shadow-lg shadow-[#5865F2]/25 transition-colors duration-200 hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
        >
          <DiscordIcon />
          Login with Discord
        </motion.button>

        <p className="mt-6 text-center text-xs text-white/30">
          By continuing, you agree to MarForms' Terms of Service and Privacy
          Policy.
        </p>
      </motion.div>
    </div>
  );
}


function DiscordIcon() {
  return <FaDiscord size={20} />;
}