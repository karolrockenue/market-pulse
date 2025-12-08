"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-right"
      expand={true}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#1a1a1a] group-[.toaster]:text-[#e5e5e5] group-[.toaster]:border-[#2a2a2a] group-[.toaster]:shadow-lg font-sans",
          description: "group-[.toast]:text-[#9ca3af]",
          actionButton:
            "group-[.toast]:bg-[#39BDF8] group-[.toast]:text-[#1d1d1c]",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-[#1a1a1a] group-[.toast]:text-[#9ca3af] group-[.toast]:border-[#333] group-[.toast]:hover:bg-[#2a2a2a] group-[.toast]:hover:text-white !left-0 !top-0",
        },
        style: {
          zIndex: 9999,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
