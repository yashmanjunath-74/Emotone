import { motion } from 'framer-motion';

const THEME_COLORS = {
  happy: ['bg-emerald-300', 'bg-teal-200', 'bg-cyan-200'],
  angry: ['bg-red-400', 'bg-rose-300', 'bg-orange-300'],
  sad: ['bg-blue-300', 'bg-indigo-300', 'bg-slate-300'],
  neutral: ['bg-slate-300', 'bg-gray-200', 'bg-zinc-200'],
  surprise: ['bg-amber-300', 'bg-yellow-200', 'bg-orange-200'],
  fear: ['bg-violet-400', 'bg-purple-300', 'bg-fuchsia-300'],
  disgust: ['bg-lime-400', 'bg-green-300', 'bg-emerald-200'],
  unknown: ['bg-sky-200', 'bg-pink-200', 'bg-blue-200'],
};

export default function FloatingBackground({ emotionKey }) {
  const colors = THEME_COLORS[emotionKey] || THEME_COLORS.unknown;

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-50 transition-colors duration-1000">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, -50, 0],
          y: [0, -50, 50, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className={`absolute -top-[10%] -left-[10%] h-[50vw] w-[50vw] rounded-full blur-[100px] opacity-50 mix-blend-multiply transition-colors duration-1000 ${colors[0]}`}
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          x: [0, -60, 60, 0],
          y: [0, 60, -60, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className={`absolute top-[20%] -right-[10%] h-[40vw] w-[40vw] rounded-full blur-[100px] opacity-50 mix-blend-multiply transition-colors duration-1000 ${colors[1]}`}
      />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          x: [0, 40, -40, 0],
          y: [0, -40, 40, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        className={`absolute -bottom-[20%] left-[20%] h-[60vw] w-[60vw] rounded-full blur-[100px] opacity-50 mix-blend-multiply transition-colors duration-1000 ${colors[2]}`}
      />
    </div>
  );
}
