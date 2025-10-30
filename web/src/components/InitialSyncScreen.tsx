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
    <div className="fixed inset-0 bg-[#252521] flex items-center justify-center z-50">
      <div className="max-w-md w-full px-6 text-center">
        {/* Animated Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            {/* Outer spinning ring */}
            <div className="w-24 h-24 border-4 border-[#3a3a35] rounded-full animate-spin border-t-[#faff6a]" />
            
            {/* Inner icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <CurrentIcon className="w-10 h-10 text-[#faff6a]" />
            </div>
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="text-white text-3xl mb-4">Connecting Your Property</h1>

        {/* Informative Subtext */}
        <p className="text-[#9ca3af] text-sm leading-relaxed mb-6">
          We're pulling your historical performance data from your Property Management System 
          to ensure your dashboard and reports are accurate from day one. This one-time process 
          may take several minutes to complete.
        </p>

        <div className="bg-[#faff6a]/10 border border-[#faff6a]/30 rounded p-3 mb-6">
          <p className="text-[#faff6a] text-xs">
            Please keep this page open while we complete the sync.
          </p>
        </div>

        {/* Dynamic Status Text */}
        <div className="bg-[#262626] rounded border border-[#3a3a35] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#9ca3af] text-xs uppercase tracking-wider">Progress</span>
            <span className="text-[#faff6a] text-xs">Step {currentStep + 1} of {steps.length}</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-[#1f1f1c] rounded-full h-2 mb-3">
            <div 
              className="bg-[#faff6a] h-2 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Current Step Text */}
          <div className="flex items-center gap-2 justify-center">
            <Loader2 className="w-4 h-4 text-[#faff6a] animate-spin" />
            <span className="text-[#e5e5e5] text-sm">{steps[currentStep].text}</span>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-center gap-2 text-[#9ca3af] text-xs">
            <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
            <span>Secure connection established</span>
          </div>
          <div className="text-[#9ca3af] text-xs">
            Expected completion: 2-5 minutes
          </div>
        </div>
      </div>
    </div>
  );
}
