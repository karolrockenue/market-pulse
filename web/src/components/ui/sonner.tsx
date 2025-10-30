"use client"; // Keep this directive

// [FIX] Removed invalid '@2.0.3' from import and removed unused ToasterProps
import { Toaster as Sonner } from "sonner"; 
// [FIX] Removed the unused 'next-themes' import

// [MODIFIED] Define the expected props directly, simplifying the component
// We expect 'theme' to be passed directly from App.tsx
interface ToasterProps {
  theme?: "light" | "dark" | "system";
  position?: string; 
  // [NEW] Explicitly define toastOptions in the component's props
  toastOptions?: {
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
  };
}

const Toaster = ({ theme, toastOptions, ...props }: ToasterProps) => {
  // [FIX] Removed the useTheme hook entirely

  // [FIX] Define our default styling class. 
  // Removed 'group toast' to fix the extra padding bug.
  const defaultClassName = 'group-[.toaster]:bg-[#262626] group-[.toaster]:text-[#e5e5e5] group-[.toaster]:border-[#3a3a35]';

  // [NEW] Merge the default class with any class passed from props (like in App.tsx)
  const mergedClassName = `${defaultClassName} ${toastOptions?.className || ''}`.trim();

  // [NEW] Combine our merged class with the rest of the toastOptions from props
  const mergedToastOptions = {
    ...toastOptions, // This brings in `style: { zIndex: 9999 }` from App.tsx
    className: mergedClassName, // This adds our styling class
  };
  
  return (
    <Sonner
      // [MODIFIED] Pass the theme prop directly. Default to 'dark' if nothing is passed.
      theme={theme || 'dark'} 
      className="toaster group"
      
      // [FIX] Pass the newly merged options
      toastOptions={mergedToastOptions}
      {...props} // Pass through any other props like 'position'
    />
  );
};

export { Toaster };