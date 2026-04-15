import { Loader2, Database, TrendingUp, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

export function InitialSyncScreen() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { icon: Database, text: 'Connecting to your PMS...' },
    { icon: Calendar, text: 'Fetching reservation history...' },
    { icon: TrendingUp, text: 'Calculating performance metrics...' },
    { icon: Database, text: 'Building your competitive set...' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#1d1d1c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }}>
      {/* Subtle grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />

      <div style={{ maxWidth: '420px', width: '100%', padding: '0 24px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        {/* Animated Icon */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '96px', height: '96px' }}>
            <div
              className="animate-spin"
              style={{
                width: '96px',
                height: '96px',
                border: '3px solid #2a2a2a',
                borderTopColor: '#38C6BA',
                borderRadius: '50%',
              }}
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CurrentIcon style={{ width: '36px', height: '36px', color: '#38C6BA' }} />
            </div>
          </div>
        </div>

        {/* Main Heading */}
        <h1 style={{
          color: '#e5e5e5',
          fontSize: '22px',
          fontWeight: 600,
          marginBottom: '12px',
          letterSpacing: '-0.025em',
        }}>
          Connecting Your Property
        </h1>

        {/* Subtext */}
        <p style={{
          color: '#6b7280',
          fontSize: '13px',
          lineHeight: '1.7',
          marginBottom: '24px',
        }}>
          We're pulling your historical performance data from your Property Management System
          to ensure your dashboard and reports are accurate from day one.
        </p>

        {/* Info Banner */}
        <div style={{
          backgroundColor: 'rgba(57, 189, 248, 0.08)',
          border: '1px solid rgba(57, 189, 248, 0.25)',
          borderRadius: '6px',
          padding: '10px 16px',
          marginBottom: '24px',
        }}>
          <p style={{ color: '#38C6BA', fontSize: '12px', margin: 0 }}>
            Please keep this page open while we complete the sync.
          </p>
        </div>

        {/* Progress Card */}
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #2a2a2a',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</span>
            <span style={{ color: '#38C6BA', fontSize: '11px' }}>Step {currentStep + 1} of {steps.length}</span>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            backgroundColor: '#0d0d0d',
            borderRadius: '4px',
            height: '6px',
            marginBottom: '14px',
          }}>
            <div style={{
              backgroundColor: '#38C6BA',
              height: '6px',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
              width: `${((currentStep + 1) / steps.length) * 100}%`,
            }} />
          </div>

          {/* Current Step */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" style={{ width: '14px', height: '14px', color: '#38C6BA' }} />
            <span style={{ color: '#e5e5e5', fontSize: '13px' }}>{steps[currentStep].text}</span>
          </div>
        </div>

        {/* Footer Info */}
        <div style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <div className="animate-pulse" style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%' }} />
            <span style={{ color: '#6b7280', fontSize: '11px' }}>Secure connection established</span>
          </div>
          <div style={{ color: '#6b7280', fontSize: '11px' }}>
            Expected completion: 2–5 minutes
          </div>
        </div>
      </div>
    </div>
  );
}
