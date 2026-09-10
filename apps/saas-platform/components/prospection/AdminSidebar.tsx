"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Bell,
  MessageSquareText,
  Calendar,
  FileText,
  UserCheck,
  BarChart3,
  ArrowLeftRight,
  Settings,
} from "lucide-react";

const navItems = [
  {href:"/admin/prospection/studio",label:"Sites autonomes",icon:LayoutDashboard},
  {
    href: "/admin/prospection/inbox",
    label: "SMS & e-mails",
    icon: MessageSquareText,
  },
  {
    href: "/admin/prospection/pipeline",
    label: "Suivi commercial",
    icon: ArrowLeftRight,
  },
  {
    href: "/admin/prospection/sms",
    label: "Prospection SMS",
    icon: MessageSquareText,
  },
  {
    href: "/admin/prospection/outreach",
    label: "Recherche locale",
    icon: Megaphone,
  },
  {
    href: "/admin/prospection",
    label: "Tableau de bord",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/prospection/automation",
    label: "Projets & automatisations",
    icon: UserCheck,
  },
  { href: "/admin/prospection/prospects", label: "Prospects", icon: Users },
  { href: "/admin/prospection/campaigns", label: "Campagnes", icon: Megaphone },
  { href: "/admin/prospection/follow-ups", label: "Relances", icon: Bell },
  {
    href: "/admin/prospection/templates",
    label: "Modèles de messages",
    icon: MessageSquareText,
  },
  {
    href: "/admin/prospection/appointments",
    label: "Rendez-vous",
    icon: Calendar,
  },
  { href: "/admin/prospection/quotes", label: "Devis", icon: FileText },
  { href: "/admin/prospection/clients", label: "Clients", icon: UserCheck },
  {
    href: "/admin/prospection/statistics",
    label: "Statistiques",
    icon: BarChart3,
  },
  {
    href: "/admin/prospection/import-export",
    label: "Import / Export",
    icon: ArrowLeftRight,
  },
  { href: "/admin/prospection/settings", label: "Paramètres", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-300 lg:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-950 font-bold text-sm">
          FW
        </div>
        <span className="font-semibold text-white">Flex-Web</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin/prospection" &&
              pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation de gestion"
      className="flex gap-2 overflow-x-auto border-b bg-white p-3 lg:hidden dark:bg-slate-950"
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-sm",
            pathname === item.href ? "bg-slate-900 text-white" : "border",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
