import { useEffect, useState } from "react";

export function AgricultureBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized offset (-0.5 to 0.5)
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-background">
      {/* Agriculture-inspired subtle repeating pattern (3% opacity) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="agriGrid" width="120" height="120" patternUnits="userSpaceOnUse">
              {/* Grid lines */}
              <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#22C55E" strokeWidth="0.75" />
              
              {/* Subtle field rows curves */}
              <path d="M 0 60 Q 30 30 60 60 T 120 60" fill="none" stroke="#14B8A6" strokeWidth="0.5" strokeDasharray="3 5" />
              <path d="M 0 90 Q 30 70 60 90 T 120 90" fill="none" stroke="#14B8A6" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.5" />
              
              {/* Tiny decorative leaf vectors */}
              <path d="M 15 15 C 15 15 25 5 35 15 C 35 15 25 25 15 15 Z M 15 15 L 35 15" fill="none" stroke="#84CC16" strokeWidth="0.75" />
              <path d="M 75 75 C 75 75 85 65 95 75 C 95 75 85 85 75 75 Z M 75 75 L 95 75" fill="none" stroke="#22C55E" strokeWidth="0.75" />
              
              {/* Sprout nodes */}
              <circle cx="35" cy="15" r="1.5" fill="#84CC16" />
              <circle cx="95" cy="75" r="1.5" fill="#22C55E" />
              
              {/* Farm field diagonal lines */}
              <path d="M 10 110 L 40 80 M 20 110 L 50 80 M 30 110 L 60 80" fill="none" stroke="#22C55E" strokeWidth="0.5" opacity="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#agriGrid)" />
        </svg>
      </div>

      {/* Dynamic Ambient Glowing Shapes (Mouse responsive) */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#14B8A6]/[0.04] blur-[140px] transition-transform duration-700 ease-out"
        style={{
          transform: `translate(${mousePos.x * 60}px, ${mousePos.y * 60}px)`,
        }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] rounded-full bg-[#22C55E]/[0.03] blur-[160px] transition-transform duration-700 ease-out"
        style={{
          transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px)`,
        }}
      />
      <div 
        className="absolute top-[30%] left-[45%] w-[800px] h-[800px] rounded-full bg-[#84CC16]/[0.01] blur-[180px] transition-transform duration-1000 ease-out"
        style={{
          transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)`,
        }}
      />

      {/* Wind-inspired Particle / Sway Currents */}
      <div className="absolute inset-0 opacity-[0.12]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M -100,200 Q 200,100 500,250 T 1100,150 T 1700,300" 
            fill="none" 
            stroke="url(#windGrad1)" 
            strokeWidth="1.5" 
            className="animate-wind-flow-slow" 
          />
          <path 
            d="M -100,500 Q 400,600 800,450 T 1600,550" 
            fill="none" 
            stroke="url(#windGrad2)" 
            strokeWidth="1" 
            className="animate-wind-flow-fast" 
          />
          <defs>
            <linearGradient id="windGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0" />
              <stop offset="50%" stopColor="#14B8A6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#84CC16" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="windGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22C55E" stopOpacity="0" />
              <stop offset="40%" stopColor="#22C55E" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating Leaves */}
      <div className="absolute inset-0">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`absolute animate-float-leaf opacity-15`}
            style={{
              left: `${15 + i * 15}%`,
              top: `${10 + (i % 3) * 25}%`,
              animationDelay: `${i * 2.2}s`,
              animationDuration: `${12 + i * 4}s`,
              transform: `scale(${0.6 + (i % 3) * 0.2})`,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M2 22C2 22 6 18 12 18C18 18 22 14 22 8C22 2 18 2 18 2C18 2 14 2 8 8C2 14 2 22 2 22Z"
                fill="url(#leafGrad)"
              />
              <path
                d="M2 22C2 22 8 16 18 2"
                stroke="#030712"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="leafGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#14B8A6" />
                  <stop offset="100%" stopColor="#22C55E" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        ))}
      </div>

      {/* Animated Crop Silhouettes at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[100px] opacity-[0.05] pointer-events-none flex justify-around items-end">
        {[...Array(10)].map((_, i) => (
          <svg
            key={i}
            width="60"
            height="120"
            viewBox="0 0 60 120"
            fill="none"
            className="origin-bottom animate-crop-sway"
            style={{
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${5 + (i % 3) * 1.5}s`,
              transform: `scale(${0.7 + (i % 4) * 0.15})`
            }}
          >
            <path
              d="M30 120 V 40"
              stroke="#14B8A6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M30 80 Q 15 70 10 50"
              stroke="#22C55E"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M30 65 Q 45 55 50 35"
              stroke="#84CC16"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M30 50 Q 15 40 5 20"
              stroke="#14B8A6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="10" cy="50" r="3" fill="#84CC16" />
            <circle cx="50" cy="35" r="3" fill="#22C55E" />
            <circle cx="5" cy="20" r="3" fill="#14B8A6" />
          </svg>
        ))}
      </div>
    </div>
  );
}
