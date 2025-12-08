import { useState } from "react";
import { ClipboardList, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
// [MODIFIED] Import from local file in components folder
import { useActionList } from "./ActionListContext";

export function ActionListBell() {
  const { actionList, removeItem, clearList } = useActionList();
  const [isOpen, setIsOpen] = useState(false);

  const count = actionList.length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 rounded-lg transition-colors focus:outline-none group"
          style={{ backgroundColor: isOpen ? "#262626" : "transparent" }}
        >
          <div className="relative inline-block">
            <ClipboardList
              className="w-5 h-5 transition-colors"
              style={{ color: count > 0 ? "#39BDF8" : "#9ca3af" }}
            />

            {count > 0 && (
              <>
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center rounded-full z-10"
                  style={{
                    backgroundColor: "#39BDF8",
                    color: "#1a1a1a",
                    fontSize: "10px",
                    fontWeight: "bold",
                    minWidth: "16px",
                    height: "16px",
                    padding: "0 4px",
                    border: "2px solid #1a1a1a",
                  }}
                >
                  {count}
                </span>
                <span className="absolute -top-1 -right-1 rounded-full w-4 h-4 bg-[#39BDF8] opacity-75 animate-ping"></span>
              </>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="p-0 shadow-2xl mr-2 mt-2"
        style={{
          width: "320px",
          backgroundColor: "#1a1a1a",
          borderColor: "#2a2a2a",
          borderWidth: "1px",
          borderStyle: "solid",
          zIndex: 100,
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "#2a2a2a" }}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#39BDF8]" />
            <h3 style={{ color: "white", fontWeight: 600, fontSize: "0.9rem" }}>
              Action List
            </h3>
          </div>
          {count > 0 && (
            <button
              onClick={clearList}
              className="text-xs hover:underline"
              style={{ color: "#ef4444" }}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <ClipboardList
                className="w-8 h-8 mb-2 opacity-20"
                style={{ color: "#e5e5e5" }}
              />
              <p style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                Your action list is empty.
              </p>
              <p
                style={{
                  color: "#4a4a4a",
                  fontSize: "0.75rem",
                  marginTop: "4px",
                }}
              >
                Flag hotels in Risk Overview to see them here.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#2a2a2a" }}>
              {actionList.map((item) => (
                <div
                  key={item.id}
                  className="w-full px-4 py-3 flex items-center justify-between group hover:bg-[#202020] transition-colors"
                >
                  <span style={{ color: "#e5e5e5", fontSize: "0.85rem" }}>
                    {item.name}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-md hover:bg-[#333] text-[#6b7280] hover:text-[#ef4444] transition-colors"
                      title="Mark as Done / Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
