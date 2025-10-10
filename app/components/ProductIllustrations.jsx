// Product SVG illustrations for landing page background
export const OilBottle = ({ className = "", size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="oilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#FFA500" />
      </linearGradient>
    </defs>
    {/* Bottle body */}
    <rect x="25" y="30" width="50" height="60" rx="8" fill="url(#oilGradient)" stroke="#E6B800" strokeWidth="2"/>
    {/* Bottle neck */}
    <rect x="40" y="15" width="20" height="20" rx="3" fill="#FFD700" stroke="#E6B800" strokeWidth="2"/>
    {/* Cap */}
    <rect x="38" y="10" width="24" height="8" rx="4" fill="#FF6B35"/>
    {/* Label */}
    <rect x="30" y="40" width="40" height="20" rx="2" fill="white" opacity="0.9"/>
    <text x="50" y="52" textAnchor="middle" fontSize="8" fill="#333">OIL</text>
    {/* Oil level indicator */}
    <rect x="28" y="35" width="44" height="3" rx="1" fill="#FFA500" opacity="0.7"/>
  </svg>
)

export const RiceBag = ({ className = "", size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <pattern id="ricePattern" patternUnits="userSpaceOnUse" width="4" height="4">
        <circle cx="2" cy="2" r="1" fill="#F5F5DC" opacity="0.8"/>
      </pattern>
    </defs>
    {/* Bag body */}
    <path d="M20 25 Q20 20 25 20 L75 20 Q80 20 80 25 L85 80 Q85 85 80 85 L20 85 Q15 85 15 80 Z" 
          fill="#8B4513" stroke="#654321" strokeWidth="2"/>
    {/* Rice visible through bag */}
    <path d="M25 30 L75 30 L80 75 L20 75 Z" fill="url(#ricePattern)"/>
    {/* Bag seam */}
    <line x1="20" y1="25" x2="80" y2="25" stroke="#654321" strokeWidth="3"/>
    {/* Label */}
    <rect x="35" y="45" width="30" height="15" rx="2" fill="white" opacity="0.9"/>
    <text x="50" y="55" textAnchor="middle" fontSize="8" fill="#333">RICE</text>
    {/* Stitching details */}
    <line x1="25" y1="30" x2="25" y2="75" stroke="#654321" strokeWidth="1" strokeDasharray="2,2"/>
    <line x1="75" y1="30" x2="75" y2="75" stroke="#654321" strokeWidth="1" strokeDasharray="2,2"/>
  </svg>
)

export const SeasoningContainer = ({ className = "", size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="seasoningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF4444" />
        <stop offset="50%" stopColor="#FF6B6B" />
        <stop offset="100%" stopColor="#FF8E8E" />
      </linearGradient>
    </defs>
    {/* Container body */}
    <rect x="20" y="25" width="60" height="65" rx="8" fill="url(#seasoningGradient)" stroke="#CC3333" strokeWidth="2"/>
    {/* Lid */}
    <ellipse cx="50" cy="25" rx="30" ry="8" fill="#FF6B6B" stroke="#CC3333" strokeWidth="2"/>
    {/* Label */}
    <rect x="25" y="40" width="50" height="25" rx="3" fill="white" opacity="0.95"/>
    <text x="50" y="50" textAnchor="middle" fontSize="7" fill="#333">SEASONING</text>
    <text x="50" y="60" textAnchor="middle" fontSize="6" fill="#666">CUBE</text>
    {/* Seasoning cubes visible */}
    <rect x="30" y="70" width="8" height="8" rx="1" fill="#FFD700" opacity="0.8"/>
    <rect x="42" y="72" width="8" height="8" rx="1" fill="#FFD700" opacity="0.8"/>
    <rect x="54" y="70" width="8" height="8" rx="1" fill="#FFD700" opacity="0.8"/>
  </svg>
)

export const NestleProduct = ({ className = "", size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="nestleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E8F4FD" />
        <stop offset="100%" stopColor="#B8E0FF" />
      </linearGradient>
    </defs>
    {/* Package body */}
    <rect x="15" y="20" width="70" height="70" rx="10" fill="url(#nestleGradient)" stroke="#4A90E2" strokeWidth="2"/>
    {/* Nestle logo area */}
    <rect x="20" y="25" width="60" height="20" rx="5" fill="#FF0000" opacity="0.9"/>
    <text x="50" y="37" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">Nestlé</text>
    {/* Product name area */}
    <rect x="20" y="50" width="60" height="15" rx="3" fill="white" opacity="0.9"/>
    <text x="50" y="60" textAnchor="middle" fontSize="8" fill="#333">MILO</text>
    {/* Product image area */}
    <circle cx="50" cy="75" r="12" fill="#8B4513" opacity="0.8"/>
    <circle cx="50" cy="75" r="8" fill="#D2691E" opacity="0.9"/>
    {/* Decorative elements */}
    <circle cx="25" cy="30" r="2" fill="white" opacity="0.7"/>
    <circle cx="75" cy="35" r="2" fill="white" opacity="0.7"/>
  </svg>
)