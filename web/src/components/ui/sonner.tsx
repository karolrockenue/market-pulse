"use client";

import { Toaster as Sonner } from "sonner";

interface ToasterProps {
  theme?: "light" | "dark" | "system";
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  toastOptions?: {
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
  };
}

const Toaster = ({ theme, toastOptions, ...props }: ToasterProps) => {
  // Define the base Sentinel style to reuse
  const sentinelStyle = "group toast group-[.toaster]:bg-[#0f151a] group-[.toaster]:text-[#e5e5e5] group-[.toaster]:border-[1px] group-[.toaster]:border-[rgba(57,189,248,0.3)] group-[.toaster]:shadow-lg font-sans";

  return (
    <Sonner
      theme={theme || 'dark'}
      className="toaster group"
      toastOptions={{
        classNames: {
          // 1. Apply Sentinel Style to ALL types explicitly
          toast: sentinelStyle,
          error: sentinelStyle,
          success: sentinelStyle,
          warning: sentinelStyle,
          info: sentinelStyle,

          // 2. Style the text
          description: "group-[.toast]:text-muted-foreground",
          
          // 3. Custom Close Button (Dark Grey Circle)
          closeButton: "group-[.toast]:bg-[#1a1a1a] group-[.toast]:text-[#e5e5e5] group-[.toast]:border-[#333] group-[.toast]:hover:bg-[#2a2a2a] group-[.toast]:hover:text-white !left-0 !top-0",
          
          // 4. Action buttons
          actionButton: "group-[.toast]:bg-[#39BDF8] group-[.toast]:text-[#1d1d1c]",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
        ...toastOptions, 
        style: {
             ...toastOptions?.style,
        }
      }}
      {...props}
    />
  );
};

export { Toaster };