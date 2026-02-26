import { motion } from "framer-motion";
import { Wifi, Radio } from "lucide-react";

interface LivePulseStatusBarProps {
  isScanning: boolean;
  signalsCount?: number;
}

export default function LivePulseStatusBar({ isScanning, signalsCount = 0 }: LivePulseStatusBarProps) {
  return (
    <motion.div
      className="flex items-center gap-3 rounded-xl border border-border bg-card/80 backdrop-blur-md px-5 py-4"
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        animate={isScanning ? { scale: [1, 1.15, 1], opacity: [1, 0.7, 1] } : {}}
        transition={{ repeat: isScanning ? Infinity : 0, duration: 1.2 }}
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/15"
      >
        {isScanning ? (
          <Radio className="w-5 h-5 text-primary" />
        ) : (
          <Wifi className="w-5 h-5 text-muted-foreground" />
        )}
      </motion.span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold text-foreground">
          {isScanning ? "Scanning Internet…" : "Live Pulse"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {isScanning
            ? "Reddit · Google Trends · Competitor review gaps"
            : signalsCount > 0
              ? `${signalsCount} signals ingested`
              : "Start a scan to load live signals"}
        </p>
      </div>
      {isScanning && (
        <motion.div
          className="flex gap-1"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } },
            hidden: {},
          }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              variants={{
                visible: { scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] },
                hidden: {},
              }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
