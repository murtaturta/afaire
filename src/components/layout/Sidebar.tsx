"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer, CalendarDays, ListTodo, BarChart3, Settings } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Today", href: "/today", icon: CalendarDays },
    { name: "All Tasks", href: "/tasks", icon: ListTodo },
    { name: "Insights", href: "/insights", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-60 h-full border-r border-border bg-card text-card-foreground flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-border">
        <Timer className="w-6 h-6 text-primary" />
        <span className="font-bold text-xl tracking-tight lowercase">afaire</span>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
