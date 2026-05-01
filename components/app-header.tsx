"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { AuthNav } from "@/components/auth-nav";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
  requiresAuth: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", requiresAuth: true },
  { label: "AI Analysis", href: "/dashboard/analysis", requiresAuth: true },
  { label: "Analysis History", href: "/dashboard/analysis-history", requiresAuth: true },
  { label: "Backtest", href: "/dashboard/backtest", requiresAuth: true },
  { label: "Trade Accounts", href: "/trade-accounts", requiresAuth: true },
];

export function AppHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = !!session;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname === "/") return null;

  const visibleNavItems = mounted && status !== "loading" ? navItems.filter(item => !item.requiresAuth || isAuthenticated) : [];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-[2000px] mx-auto px-4 md:px-6 lg:px-8 flex h-16 items-center">
        {/* Mobile Navigation */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden mr-3">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] sm:w-[300px]">
            <div className="flex flex-col gap-4 py-4">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center mb-6">
                <span className="font-bold text-xl bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                  PuckFinance
                </span>
              </Link>
              {visibleNavItems.map(item => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium transition-colors hover:text-primary px-2 py-1.5 rounded-md ${
                      isActive 
                        ? "bg-accent text-foreground" 
                        : "text-muted-foreground"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="font-bold text-xl bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            PuckFinance
          </span>
        </Link>
        
        {/* Desktop Navigation */}
        {visibleNavItems.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-6 mx-4 hidden md:block" />
            <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 mx-6">
              {visibleNavItems.map(item => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      isActive 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
        
        <div className="ml-auto flex items-center">
          <AuthNav />
        </div>
      </div>
    </header>
  );
} 