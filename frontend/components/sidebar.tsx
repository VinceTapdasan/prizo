"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Users,
  Gift,
  QrCode,
  BarChart2,
  Settings,
  Store,
  Sun,
  Moon,
  X,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Rewards", href: "/dashboard/rewards", icon: Gift },
  { label: "QR Code", href: "/dashboard/qr-code", icon: QrCode },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
];

const bottomItems = [
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onClose,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClose?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon size={16} strokeWidth={1.5} />
      <span>{label}</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Sun size={16} strokeWidth={1.5} className="hidden dark:block" />
      <Moon size={16} strokeWidth={1.5} className="block dark:hidden" />
      <span className="text-sm">
        <span className="hidden dark:inline">Light mode</span>
        <span className="dark:hidden">Dark mode</span>
      </span>
    </button>
  );
}

function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <LogOut size={16} strokeWidth={1.5} />
      <span className="text-sm">Sign out</span>
    </button>
  );
}

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Prizo
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
            onClose={onClose}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border p-3">
        {bottomItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
            onClose={onClose}
          />
        ))}

        <ThemeToggle />
        <SignOutButton />

        <div className="mt-2 flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
            <Store size={14} strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-sidebar-foreground">
              My Venue
            </span>
            <span className="text-xs text-muted-foreground">Business</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
