// Food Distribution & Cooperative Themed Background Components
export const DeliveryTruck = ({ className = "", size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="truckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    {/* Truck body */}
    <rect x="15" y="35" width="50" height="25" rx="3" fill="url(#truckGradient)" stroke="#2563EB" strokeWidth="1"/>
    {/* Truck cab */}
    <rect x="10" y="40" width="20" height="20" rx="2" fill="url(#truckGradient)" stroke="#2563EB" strokeWidth="1"/>
    {/* Wheels */}
    <circle cx="25" cy="65" r="6" fill="#374151" stroke="#1F2937" strokeWidth="1"/>
    <circle cx="55" cy="65" r="6" fill="#374151" stroke="#1F2937" strokeWidth="1"/>
    <circle cx="25" cy="65" r="3" fill="#6B7280"/>
    <circle cx="55" cy="65" r="3" fill="#6B7280"/>
    {/* Window */}
    <rect x="12" y="42" width="8" height="6" rx="1" fill="#E5E7EB" opacity="0.8"/>
    {/* CBN Logo area */}
    <rect x="20" y="45" width="35" height="10" rx="1" fill="white" opacity="0.9"/>
    <text x="37" y="52" textAnchor="middle" fontSize="6" fill="#1E40AF" fontWeight="bold">CBN COOP</text>
  </svg>
)

export const Warehouse = ({ className = "", size = 90 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="warehouseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#047857" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    {/* Building base */}
    <rect x="20" y="45" width="60" height="40" fill="url(#warehouseGradient)" stroke="#059669" strokeWidth="1"/>
    {/* Roof */}
    <polygon points="15,45 50,25 85,45" fill="#059669" opacity="0.7"/>
    {/* Door */}
    <rect x="40" y="65" width="20" height="20" fill="#374151" opacity="0.8"/>
    <rect x="42" y="67" width="16" height="16" fill="#4B5563" opacity="0.6"/>
    {/* Windows */}
    <rect x="25" y="55" width="8" height="6" fill="#E5E7EB" opacity="0.8"/>
    <rect x="67" y="55" width="8" height="6" fill="#E5E7EB" opacity="0.8"/>
    {/* Loading dock */}
    <rect x="15" y="75" width="10" height="10" fill="#6B7280" opacity="0.6"/>
  </svg>
)

export const CommunityHands = ({ className = "", size = 70 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="handsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#D97706" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    {/* Left hand */}
    <path d="M25 60 Q20 50 25 45 Q30 40 35 45 Q40 50 35 60 Q30 65 25 60" fill="url(#handsGradient)"/>
    {/* Right hand */}
    <path d="M75 60 Q80 50 75 45 Q70 40 65 45 Q60 50 65 60 Q70 65 75 60" fill="url(#handsGradient)"/>
    {/* Center connection */}
    <circle cx="50" cy="50" r="8" fill="#F59E0B" opacity="0.7"/>
    <circle cx="50" cy="50" r="4" fill="white" opacity="0.8"/>
    {/* Unity symbol */}
    <path d="M45 47 L50 52 L55 47" stroke="white" strokeWidth="2" fill="none" opacity="0.9"/>
  </svg>
)

export const FoodBasket = ({ className = "", size = 60 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="basketGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#92400E" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#78350F" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    {/* Basket body */}
    <path d="M20 45 Q20 40 25 40 L75 40 Q80 40 80 45 L75 75 Q75 80 70 80 L30 80 Q25 80 25 75 Z" 
          fill="url(#basketGradient)" stroke="#92400E" strokeWidth="1"/>
    {/* Basket weave pattern */}
    <line x1="25" y1="50" x2="75" y2="50" stroke="#78350F" strokeWidth="1" opacity="0.6"/>
    <line x1="25" y1="60" x2="75" y2="60" stroke="#78350F" strokeWidth="1" opacity="0.6"/>
    <line x1="25" y1="70" x2="75" y2="70" stroke="#78350F" strokeWidth="1" opacity="0.6"/>
    {/* Handle */}
    <path d="M35 40 Q35 30 50 30 Q65 30 65 40" stroke="#92400E" strokeWidth="3" fill="none"/>
    {/* Food items (abstract shapes) */}
    <circle cx="40" cy="55" r="4" fill="#DC2626" opacity="0.7"/>
    <circle cx="55" cy="60" fill="#16A34A" opacity="0.7"/>
    <rect x="45" y="65" width="6" height="6" rx="1" fill="#CA8A04" opacity="0.7"/>
  </svg>
)

export const CooperativeSymbol = ({ className = "", size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="coopGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#5B21B6" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    {/* Outer circle representing unity */}
    <circle cx="50" cy="50" r="35" fill="none" stroke="url(#coopGradient)" strokeWidth="3" opacity="0.6"/>
    {/* Inner connected people */}
    <circle cx="35" cy="40" r="6" fill="#7C3AED" opacity="0.7"/>
    <circle cx="65" cy="40" r="6" fill="#7C3AED" opacity="0.7"/>
    <circle cx="50" cy="65" r="6" fill="#7C3AED" opacity="0.7"/>
    <circle cx="30" cy="65" r="6" fill="#7C3AED" opacity="0.7"/>
    <circle cx="70" cy="65" r="6" fill="#7C3AED" opacity="0.7"/>
    {/* Connection lines */}
    <line x1="35" y1="40" x2="50" y2="50" stroke="#7C3AED" strokeWidth="2" opacity="0.5"/>
    <line x1="65" y1="40" x2="50" y2="50" stroke="#7C3AED" strokeWidth="2" opacity="0.5"/>
    <line x1="50" y1="50" x2="50" y2="65" stroke="#7C3AED" strokeWidth="2" opacity="0.5"/>
    <line x1="50" y1="50" x2="30" y2="65" stroke="#7C3AED" strokeWidth="2" opacity="0.5"/>
    <line x1="50" y1="50" x2="70" y2="65" stroke="#7C3AED" strokeWidth="2" opacity="0.5"/>
    {/* Center hub */}
    <circle cx="50" cy="50" r="4" fill="#7C3AED" opacity="0.8"/>
  </svg>
)

export const DistributionRoute = ({ className = "", width = 120, height = 40 }) => (
  <svg width={width} height={height} viewBox="0 0 120 40" className={className}>
    <defs>
      <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#059669" stopOpacity="0.6" />
        <stop offset="50%" stopColor="#10B981" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
      </linearGradient>
    </defs>
    {/* Route path */}
    <path d="M10 20 Q40 10 70 20 Q100 30 110 20" stroke="url(#routeGradient)" strokeWidth="3" fill="none"/>
    {/* Route markers */}
    <circle cx="10" cy="20" r="3" fill="#059669" opacity="0.8"/>
    <circle cx="40" cy="15" r="2" fill="#10B981" opacity="0.7"/>
    <circle cx="70" cy="20" r="2" fill="#10B981" opacity="0.7"/>
    <circle cx="110" cy="20" r="3" fill="#059669" opacity="0.8"/>
    {/* Direction arrows */}
    <polygon points="25,18 30,20 25,22" fill="#059669" opacity="0.6"/>
    <polygon points="85,18 90,20 85,22" fill="#059669" opacity="0.6"/>
  </svg>
)