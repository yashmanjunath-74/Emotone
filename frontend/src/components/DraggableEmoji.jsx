import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const EMOTION_EMOJIS = {
  happy: ['😊', '😄', '🌟', '🎉', '💖'],
  angry: ['😠', '😡', '💥', '🔥', '💢'],
  sad: ['😢', '😭', '🌧️', '💔', '🥀'],
  neutral: ['😐', '😶', '✨', '🍃', '☁️'],
  surprise: ['😲', '🤯', '🎆', '🚀', '⚡'],
  fear: ['😨', '😱', '🕸️', '🌑', '🦇'],
  disgust: ['🤢', '🤮', '🦠', '🥀', '🍂'],
  unknown: ['🎵', '🎶', '🔊', '🎙️', '✨']
};

export default function DraggableEmoji({ emotionKey }) {
  const [windowDimensions, setWindowDimensions] = useState({ width: 1000, height: 800 });
  const [emojis, setEmojis] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      
      const handleResize = () => {
        setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    const key = emotionKey || 'unknown';
    const list = EMOTION_EMOJIS[key] || EMOTION_EMOJIS.unknown;
    
    // Generate 5-8 random emojis from the list
    const numEmojis = 5 + Math.floor(Math.random() * 4);
    const newEmojis = Array.from({ length: numEmojis }).map((_, i) => {
      const emoji = list[Math.floor(Math.random() * list.length)];
      return {
        id: `${key}-${i}-${Math.random()}`,
        emoji,
        initialX: Math.random() * (windowDimensions.width - 100),
        initialY: Math.random() * (windowDimensions.height - 100),
        size: Math.random() * 30 + 30, // 30 to 60px
      };
    });
    
    setEmojis(newEmojis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotionKey]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {emojis.map((item) => (
        <motion.div
          key={item.id}
          drag
          dragConstraints={{
            top: 0,
            left: 0,
            right: windowDimensions.width - item.size * 1.5,
            bottom: windowDimensions.height - item.size * 1.5,
          }}
          dragElastic={0.2}
          whileDrag={{ scale: 1.2, cursor: "grabbing" }}
          whileHover={{ scale: 1.1, cursor: "grab" }}
          className="pointer-events-auto absolute flex items-center justify-center rounded-full bg-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] backdrop-blur-md border border-white/40"
          style={{ width: item.size * 1.5, height: item.size * 1.5 }}
          initial={{ opacity: 0, scale: 0, x: windowDimensions.width / 2, y: windowDimensions.height / 2 }}
          animate={{ opacity: 1, scale: 1, x: item.initialX, y: item.initialY }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: Math.random() * 0.3 }}
        >
          <span style={{ fontSize: item.size }}>{item.emoji}</span>
        </motion.div>
      ))}
    </div>
  );
}
