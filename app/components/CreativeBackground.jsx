// Creative Abstract Background Components
export const FloatingOrb = ({ className = "", size = 80, color = "blue" }) => {
  const colors = {
    blue: ["#3B82F6", "#1D4ED8", "#1E40AF"],
    green: ["#10B981", "#059669", "#047857"],
    purple: ["#8B5CF6", "#7C3AED", "#6D28D9"],
    orange: ["#F59E0B", "#D97706", "#B45309"],
    pink: ["#EC4899", "#DB2777", "#BE185D"]
  }
  
  const colorSet = colors[color] || colors.blue
  
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      <defs>
        <radialGradient id={`orbGradient-${color}`} cx="30%" cy="30%">
          <stop offset="0%" stopColor={colorSet[0]} stopOpacity="0.8" />
          <stop offset="50%" stopColor={colorSet[1]} stopOpacity="0.6" />
          <stop offset="100%" stopColor={colorSet[2]} stopOpacity="0.3" />
        </radialGradient>
        <filter id={`glow-${color}`}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="40" fill={`url(#orbGradient-${color})`} filter={`url(#glow-${color})`} />
      <circle cx="35" cy="35" r="8" fill="white" opacity="0.4" />
      <circle cx="60" cy="25" r="4" fill="white" opacity="0.6" />
    </svg>
  )
}

export const GeometricShape = ({ className = "", size = 60, type = "triangle" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="shapeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366F1" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    {type === "triangle" && (
      <polygon points="50,10 90,80 10,80" fill="url(#shapeGradient)" stroke="#6366F1" strokeWidth="1" opacity="0.7" />
    )}
    {type === "hexagon" && (
      <polygon points="50,5 85,25 85,65 50,85 15,65 15,25" fill="url(#shapeGradient)" stroke="#6366F1" strokeWidth="1" opacity="0.7" />
    )}
    {type === "diamond" && (
      <polygon points="50,10 80,50 50,90 20,50" fill="url(#shapeGradient)" stroke="#6366F1" strokeWidth="1" opacity="0.7" />
    )}
  </svg>
)

export const FlowingWave = ({ className = "", width = 200, height = 60 }) => (
  <svg width={width} height={height} viewBox="0 0 200 60" className={className}>
    <defs>
      <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
        <stop offset="50%" stopColor="#0891B2" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#0E7490" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    <path d="M0,30 Q50,10 100,30 T200,30 L200,60 L0,60 Z" fill="url(#waveGradient)" />
    <path d="M0,35 Q50,15 100,35 T200,35" stroke="#06B6D4" strokeWidth="2" fill="none" opacity="0.8" />
  </svg>
)

export const NetworkNode = ({ className = "", size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className}>
    <defs>
      <radialGradient id="nodeGradient" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
      </radialGradient>
    </defs>
    <circle cx="20" cy="20" r="6" fill="url(#nodeGradient)" />
    <circle cx="20" cy="20" r="12" fill="none" stroke="#10B981" strokeWidth="1" opacity="0.3" />
    <circle cx="20" cy="20" r="18" fill="none" stroke="#10B981" strokeWidth="0.5" opacity="0.2" />
  </svg>
)

export const ConnectionLine = ({ className = "", width = 100, angle = 0 }) => (
  <svg width={width} height="2" viewBox={`0 0 ${width} 2`} className={className} style={{transform: `rotate(${angle}deg)`}}>
    <defs>
      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#10B981" stopOpacity="0" />
        <stop offset="50%" stopColor="#10B981" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
      </linearGradient>
    </defs>
    <line x1="0" y1="1" x2={width} y2="1" stroke="url(#lineGradient)" strokeWidth="2" />
  </svg>
)

export const AbstractPattern = ({ className = "", size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className={className}>
    <defs>
      <pattern id="dotPattern" patternUnits="userSpaceOnUse" width="10" height="10">
        <circle cx="5" cy="5" r="1" fill="#6366F1" opacity="0.3" />
      </pattern>
    </defs>
    <rect width="80" height="80" fill="url(#dotPattern)" />
    <circle cx="40" cy="40" r="25" fill="none" stroke="#8B5CF6" strokeWidth="1" opacity="0.4" strokeDasharray="5,5" />
    <circle cx="40" cy="40" r="15" fill="none" stroke="#A855F7" strokeWidth="1" opacity="0.6" strokeDasharray="3,3" />
  </svg>
)