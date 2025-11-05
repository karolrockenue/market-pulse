// Imports for icons
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Define the props the component will accept
interface MarketOutlookBannerProps {
  status: 'strengthening' | 'softening' | 'stable';
  metric: string;

}

// Helper object to store content for each status
const statusContent = {
  strengthening: {
   title: 'The 30-day market demand is', // [MODIFIED]
    Icon: TrendingUp,
    // Using inline styles as required
    style: {
      background: 'rgba(34, 197, 94, 0.1)', // Green tint
      borderColor: 'rgba(34, 197, 94, 0.4)',
      iconColor: '#22c55e',
      textColor: '#86efac',
    }
  },
  softening: {
 title: 'The 30-day market demand is', // [MODIFIED]
    Icon: TrendingDown,
    style: {
      background: 'rgba(239, 68, 68, 0.1)', // Red tint
      borderColor: 'rgba(239, 68, 68, 0.4)',
      iconColor: '#ef4444',
      textColor: '#fca5a5',
    }
  },
  stable: {
  title: 'The 30-day market demand is', // [MODIFIED]
    Icon: Minus,
    style: {
      background: 'rgba(234, 179, 8, 0.1)', // Yellow tint
      borderColor: 'rgba(234, 179, 8, 0.4)',
      iconColor: '#eab308',
      textColor: '#fde047',
    }
  }
};

export function MarketOutlookBanner({ status, metric }: MarketOutlookBannerProps) {
  // Get the correct content based on the status prop
  const content = statusContent[status] || statusContent.stable;
  
  return (
    // Using inline style prop for layout
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px',
      borderRadius: '8px',
      borderWidth: '1px',
      marginBottom: '24px',
      ...content.style
    }}>
      {/* Icon */}
      <div style={{
        flexShrink: 0,
        width: '40px',
        height: '40px',
        borderRadius: '9999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.2)',
        border: `1px solid ${content.style.borderColor}`
      }}>
        <content.Icon className="w-5 h-5" style={{ color: content.style.iconColor }} />
      </div>
      
      {/* Text Content */}
      <div style={{ flexGrow: 1 }}>
<h3 style={{
      fontSize: '16px',
      fontWeight: '500',
      color: content.textColor
    }}>
      {content.title} {status}
    </h3>
    <p style={{
      fontSize: '12px',
      color: '#9ca3af' // text-gray-400
    }}>
      This trend is calculated by analyzing thousands of data points collected daily from live market sources, including OTA availability and advertised prices.
    </p>
      </div>
      
      {/* Metric */}
      <div style={{
        fontSize: '24px',
        fontWeight: '600',
        color: content.style.textColor,
        marginLeft: '16px',
        whiteSpace: 'nowrap'
      }}>
        {metric}
      </div>
    </div>
  );
}