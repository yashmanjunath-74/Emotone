import { motion } from 'framer-motion';

export default function AudioVisualizer({ isPlaying, colorClass = "bg-slate-500" }) {
  const bars = Array.from({ length: 32 });

  return (
    <div className="flex items-center justify-center gap-1 h-32 w-full p-4 rounded-2xl bg-white/40 shadow-inner backdrop-blur-md border border-white/50">
      {bars.map((_, i) => (
        <motion.div
          key={i}
          className={`w-2 md:w-3 rounded-full ${colorClass}`}
          initial={{ height: "4px" }}
          animate={{
            height: isPlaying
              ? ["4px", `${Math.random() * 80 + 20}px`, `${Math.random() * 40 + 10}px`, "4px"]
              : "4px",
          }}
          transition={{
            duration: isPlaying ? 0.5 + Math.random() * 0.5 : 0.5,
            repeat: isPlaying ? Infinity : 0,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
