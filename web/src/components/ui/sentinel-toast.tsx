import { toast } from "sonner";
import { Zap } from "lucide-react";

type MaybeDescription = string | undefined;

export const sentinelToast = {
  message: (title: string, description?: MaybeDescription) =>
    toast.message(title, {
      description,
      icon: <Zap className="w-4 h-4 text-[#39BDF8]" />,
      style: {
        backgroundColor: "#0f151a",
        border: "1px solid rgba(57, 189, 248, 0.3)",
        color: "#e5e5e5",
      },
    }),

  success: (title: string, description?: MaybeDescription) =>
    toast.success(title, {
      description,
      icon: <Zap className="w-4 h-4 text-[#39BDF8]" />,
      style: {
        backgroundColor: "#0f151a",
        border: "1px solid rgba(57, 189, 248, 0.3)",
        color: "#e5e5e5",
      },
    }),

  error: (title: string, description?: MaybeDescription) =>
    toast.error(title, {
      description,
      icon: <Zap className="w-4 h-4 text-[#39BDF8]" />,
      style: {
        backgroundColor: "#1a0f0f",
        border: "1px solid rgba(248, 57, 57, 0.3)",
        color: "#fee2e2",
      },
    }),

  loading: (title: string, description?: MaybeDescription) =>
    toast.loading(title, {
      description,
      style: {
        backgroundColor: "#0f151a",
        border: "1px solid rgba(57, 189, 248, 0.3)",
        color: "#e5e5e5",
      },
    }),
};
