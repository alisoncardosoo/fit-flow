import { PageHeader } from "@/components/PageHeader";
import { SupportDevCard } from "@/components/SupportDevCard";
import { motion } from "framer-motion";

export default function SupportDev() {
  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader eyebrow="Comunidade" title="Apoie o Dev" />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SupportDevCard variant="full" />
      </motion.div>
    </div>
  );
}
