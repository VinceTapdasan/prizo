"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <span className="text-base font-semibold tracking-tight text-foreground">
          Prizo
        </span>
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
      </header>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Slide-out sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
