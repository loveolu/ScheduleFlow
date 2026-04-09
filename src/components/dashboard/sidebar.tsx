"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Inbox,
  Clock,
  BarChart3,
  GitBranch,
  Vote,
  Plug,
  Users,
  Settings,
  Menu,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Event Types", href: "/dashboard/event-types", icon: Calendar },
      { label: "Bookings", href: "/dashboard/bookings", icon: Inbox },
      { label: "Availability", href: "/dashboard/availability", icon: Clock },
    ],
  },
  {
    title: "Advanced",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      {
        label: "Routing Forms",
        href: "/dashboard/routing",
        icon: GitBranch,
      },
      { label: "Polls", href: "/dashboard/polls", icon: Vote },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        label: "Integrations",
        href: "/dashboard/integrations",
        icon: Plug,
      },
      { label: "Teams", href: "/dashboard/teams", icon: Users },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-indigo-500/15 text-indigo-400"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg bg-indigo-500/15"
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
      <Icon
        className={cn(
          "relative z-10 h-4 w-4 shrink-0",
          active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
        )}
      />
      {!collapsed && (
        <span className="relative z-10 truncate">{item.label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger >{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function SidebarContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500">
            <span className="text-sm font-bold text-white">SF</span>
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-white">
              ScheduleFlow
            </span>
          )}
        </Link>
        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
        {onToggle && collapsed && (
          <button
            onClick={onToggle}
            className="absolute right-2 top-5 rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <Separator className="bg-white/5" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-6">
          {navigation.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  {group.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <Separator className="bg-white/5" />

      {/* Theme toggle */}
      <div className="flex items-center justify-center px-3 py-2">
        <ThemeToggle />
      </div>

      <Separator className="bg-white/5" />

      {/* User section */}
      <div className="p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5",
            collapsed && "justify-center"
          )}
        >
          <Avatar size="default">
            <AvatarImage
              src={session?.user?.image ?? undefined}
              alt={session?.user?.name ?? "User"}
            />
            <AvatarFallback className="bg-slate-800 text-xs text-slate-300">
              {getInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-slate-200">
                {session?.user?.name ?? "User"}
              </p>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[10px] font-medium bg-indigo-500/15 text-indigo-400 border-0"
                >
                  {(session?.user as Record<string, unknown>)?.plan === "PRO"
                    ? "Pro"
                    : (session?.user as Record<string, unknown>)?.plan === "TEAM"
                      ? "Team"
                      : "Free"}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
        className="hidden lg:flex h-screen shrink-0 border-r border-white/5 bg-slate-950"
      >
        <SidebarContent
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </motion.aside>

      {/* Mobile sidebar via Sheet */}
      <div className="lg:hidden fixed top-0 left-0 z-40 p-3">
        <Sheet>
          <SheetTrigger >
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 bg-slate-950/90 text-white backdrop-blur-sm border border-white/10 hover:bg-slate-900 hover:text-white"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 border-white/5" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
