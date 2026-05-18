import { motion } from "framer-motion";
import logo from "@/assets/logo.png";

export function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <motion.img
          src={logo}
          alt="Flow"
          className="h-28 w-28 rounded-[28px] shadow-glow animate-pulse-glow"
          initial={{ y: 6 }}
          animate={{ y: 0 }}
        />
      </motion.div>
    </div>
  );
}
