// Professional Static Background Components for Food Distribution Cooperative
export const ProfessionalDeliveryTruck = ({ className = "", size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" className={className}>
    <defs>
      <linearGradient id="professionalTruckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.15" />
        <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.08" />
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#1E40AF" floodOpacity="0.1"/>
      </filter>
    </defs>
    {/* Truck body with professional styling */}
    <rect x="25" y="45" width="65" height="35" rx="4" fill="url(#professionalTruckGradient)" 
          stroke="#2563EB" strokeWidth="1.5" filter="url(#softShadow)"/>
    {/* Truck cab */}
    <rect x="18" y="50" width="25" height="25" rx="3" fill="url(#professionalTruckGradient)" 
          stroke="#2563EB" strokeWidth="1.5" filter="url(#softShadow)"/>
    {/* Professional wheels */}
    <circle cx="35" cy="85" r="8" fill="#374151" stroke="#1F2937" strokeWidth="1.5"/>
    <circle cx="75" cy="85" r="8" fill="#374151" stroke="#1F2937" strokeWidth="1.5"/>
    <circle cx="35" cy="85" r="4" fill="#9CA3AF"/>
    <circle cx="75" cy="85" r="4" fill="#9CA3AF"/>
    {/* Professional window */}
    <rect x="20" y="52" width="12" height="8" rx="2" fill="#E5E7EB" opacity="0.9"/>
    {/* Company branding area */}
    <rect x="30" y="55" width="50" height="15" rx="2" fill="white" opacity="0.95"/>
    <text x="55" y="65" textAnchor="middle" fontSize="8" fill="#1E40AF" fontWeight="600">CBN COOPERATIVE</text>
    {/* Professional details */}
    <rect x="30" y="72" width="50" height="2" rx="1" fill="#3B82F6" opacity="0.6"/>
  </svg>
)

export const ProfessionalWarehouse = ({ className = "", size = 140 }) => (
  <svg width={size} height={size} viewBox="0 0 140 140" className={className}>
    <defs>
      <linearGradient id="professionalWarehouseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#059669" stopOpacity="0.12" />
        <stop offset="50%" stopColor="#10B981" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#34D399" stopOpacity="0.06" />
      </linearGradient>
      <filter id="warehouseShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="3" stdDeviation="4" floodColor="#059669" floodOpacity="0.08"/>
      </filter>
    </defs>
    {/* Main building structure */}
    <rect x="25" y="60" width="90" height="55" fill="url(#professionalWarehouseGradient)" 
          stroke="#059669" strokeWidth="1.5" filter="url(#warehouseShadow)"/>
    {/* Professional roof design */}
    <polygon points="20,60 70,35 120,60" fill="#047857" opacity="0.8" filter="url(#warehouseShadow)"/>
    <polygon points="22,58 70,37 118,58" fill="#059669" opacity="0.6"/>
    {/* Loading bay doors */}
    <rect x="35" y="85" width="25" height="30" fill="#374151" opacity="0.7" rx="2"/>
    <rect x="80" y="85" width="25" height="30" fill="#374151" opacity="0.7" rx="2"/>
    {/* Professional windows */}
    <rect x="45" y="70" width="12" height="8" fill="#E5E7EB" opacity="0.9" rx="1"/>
    <rect x="83" y="70" width="12" height="8" fill="#E5E7EB" opacity="0.9" rx="1"/>
    {/* Company signage */}
    <rect x="30" y="45" width="80" height="12" fill="white" opacity="0.95" rx="2"/>
    <text x="70" y="53" textAnchor="middle" fontSize="9" fill="#047857" fontWeight="600">FOOD DISTRIBUTION CENTER</text>
    {/* Professional architectural details */}
    <line x1="25" y1="75" x2="115" y2="75" stroke="#059669" strokeWidth="1" opacity="0.5"/>
    <line x1="25" y1="95" x2="115" y2="95" stroke="#059669" strokeWidth="1" opacity="0.5"/>
  </svg>
)

export const ProfessionalCommunitySymbol = ({ className = "", size = 100 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <radialGradient id="professionalCommunityGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.15" />
        <stop offset="70%" stopColor="#8B5CF6" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.05" />
      </radialGradient>
      <filter id="communityShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#7C3AED" floodOpacity="0.08"/>
      </filter>
    </defs>
    {/* Outer unity circle */}
    <circle cx="50" cy="50" r="40" fill="none" stroke="#7C3AED" strokeWidth="2" opacity="0.4" filter="url(#communityShadow)"/>
    <circle cx="50" cy="50" r="35" fill="url(#professionalCommunityGradient)"/>
    
    {/* Professional people representation */}
    <circle cx="35" cy="40" r="6" fill="#7C3AED" opacity="0.8"/>
    <circle cx="65" cy="40" r="6" fill="#7C3AED" opacity="0.8"/>
    <circle cx="50" cy="65" r="6" fill="#7C3AED" opacity="0.8"/>
    <circle cx="30" cy="65" r="6" fill="#7C3AED" opacity="0.8"/>
    <circle cx="70" cy="65" r="6" fill="#7C3AED" opacity="0.8"/>
    
    {/* Professional connection network */}
    <line x1="35" y1="40" x2="50" y2="50" stroke="#7C3AED" strokeWidth="1.5" opacity="0.6"/>
    <line x1="65" y1="40" x2="50" y2="50" stroke="#7C3AED" strokeWidth="1.5" opacity="0.6"/>
    <line x1="50" y1="50" x2="50" y2="65" stroke="#7C3AED" strokeWidth="1.5" opacity="0.6"/>
    <line x1="50" y1="50" x2="30" y2="65" stroke="#7C3AED" strokeWidth="1.5" opacity="0.6"/>
    <line x1="50" y1="50" x2="70" y2="65" stroke="#7C3AED" strokeWidth="1.5" opacity="0.6"/>
    
    {/* Central hub with professional styling */}
    <circle cx="50" cy="50" r="5" fill="#7C3AED" opacity="0.9"/>
    <circle cx="50" cy="50" r="2" fill="white" opacity="0.9"/>
  </svg>
)

export const ProfessionalFoodBasket = ({ className = "", size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" className={className}>
    <defs>
      <linearGradient id="professionalBasketGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#D97706" stopOpacity="0.12" />
        <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#FCD34D" stopOpacity="0.06" />
      </linearGradient>
      <filter id="basketShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#D97706" floodOpacity="0.08"/>
      </filter>
    </defs>
    {/* Professional basket design */}
    <path d="M15 35 Q15 30 20 30 L60 30 Q65 30 65 35 L60 60 Q60 65 55 65 L25 65 Q20 65 20 60 Z" 
          fill="url(#professionalBasketGradient)" stroke="#D97706" strokeWidth="1.5" filter="url(#basketShadow)"/>
    
    {/* Elegant weave pattern */}
    <line x1="20" y1="40" x2="60" y2="40" stroke="#D97706" strokeWidth="1" opacity="0.5"/>
    <line x1="20" y1="50" x2="60" y2="50" stroke="#D97706" strokeWidth="1" opacity="0.5"/>
    <line x1="20" y1="60" x2="60" y2="60" stroke="#D97706" strokeWidth="1" opacity="0.5"/>
    
    {/* Professional handle */}
    <path d="M25 30 Q25 20 40 20 Q55 20 55 30" stroke="#D97706" strokeWidth="2.5" fill="none" opacity="0.8"/>
    
    {/* Stylized food representation */}
    <circle cx="30" cy="45" r="3" fill="#DC2626" opacity="0.7"/>
    <circle cx="45" cy="50" r="3" fill="#16A34A" opacity="0.7"/>
    <rect x="50" y="55" width="5" height="5" rx="1" fill="#CA8A04" opacity="0.7"/>
    <ellipse cx="35" cy="55" rx="3" ry="2" fill="#7C2D12" opacity="0.7"/>
  </svg>
)

export const ProfessionalDistributionNetwork = ({ className = "", width = 200, height = 80 }) => (
  <svg width={width} height={height} viewBox="0 0 200 80" className={className}>
    <defs>
      <linearGradient id="professionalNetworkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#059669" stopOpacity="0.12" />
        <stop offset="25%" stopColor="#10B981" stopOpacity="0.15" />
        <stop offset="75%" stopColor="#34D399" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#059669" stopOpacity="0.12" />
      </linearGradient>
      <filter id="networkShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="1" dy="1" stdDeviation="2" floodColor="#059669" floodOpacity="0.1"/>
      </filter>
    </defs>
    
    {/* Professional distribution path */}
    <path d="M20 40 Q60 25 100 40 Q140 55 180 40" stroke="url(#professionalNetworkGradient)" 
          strokeWidth="3" fill="none" filter="url(#networkShadow)"/>
    
    {/* Distribution nodes with professional styling */}
    <circle cx="20" cy="40" r="4" fill="#059669" opacity="0.8"/>
    <circle cx="60" cy="30" r="3" fill="#10B981" opacity="0.7"/>
    <circle cx="100" cy="40" r="3" fill="#10B981" opacity="0.7"/>
    <circle cx="140" cy="50" r="3" fill="#10B981" opacity="0.7"/>
    <circle cx="180" cy="40" r="4" fill="#059669" opacity="0.8"/>
    
    {/* Professional connection indicators */}
    <rect x="18" y="45" width="4" height="8" rx="1" fill="#059669" opacity="0.6"/>
    <rect x="178" y="45" width="4" height="8" rx="1" fill="#059669" opacity="0.6"/>
  </svg>
)

export const ProfessionalCooperativeLogo = ({ className = "", size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" className={className}>
    <defs>
      <radialGradient id="professionalLogoGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.08" />
        <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.06" />
      </radialGradient>
      <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="4" floodColor="#1E40AF" floodOpacity="0.1"/>
      </filter>
    </defs>
    
    {/* Professional circular frame */}
    <circle cx="60" cy="60" r="50" fill="url(#professionalLogoGradient)" filter="url(#logoShadow)"/>
    <circle cx="60" cy="60" r="45" fill="none" stroke="#1E40AF" strokeWidth="2" opacity="0.4"/>
    
    {/* Stylized cooperative elements */}
    <rect x="35" y="45" width="50" height="8" rx="4" fill="#1E40AF" opacity="0.6"/>
    <rect x="40" y="55" width="40" height="6" rx="3" fill="#3B82F6" opacity="0.5"/>
    <rect x="45" y="65" width="30" height="4" rx="2" fill="#60A5FA" opacity="0.4"/>
    
    {/* Professional text area */}
    <rect x="25" y="75" width="70" height="12" rx="2" fill="white" opacity="0.9"/>
    <text x="60" y="83" textAnchor="middle" fontSize="8" fill="#1E40AF" fontWeight="600">COOPERATIVE</text>
  </svg>
)