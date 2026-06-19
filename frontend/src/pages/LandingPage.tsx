// src/pages/LandingPage.tsx
import { motion } from "framer-motion";
import { BackgroundGlow } from "../components/LoadingScreen";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0f] px-4">
      <BackgroundGlow />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10"
      >
        <div className="mb-5 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/30">
            MF
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-white">MarForms</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          You need a direct link to a form to continue. If someone shared a
          MarForms link with you, open it to get started.
        </p>
      </motion.div>
    </div>
  );
}