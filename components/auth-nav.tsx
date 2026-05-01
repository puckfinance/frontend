"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function AuthNav() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || status === "loading") {
    return (
      <div className="animate-pulse h-10 w-32 bg-gray-200 rounded"></div>
    );
  }

  if (session) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <Button variant="ghost" size="sm" asChild className="text-xs sm:text-sm px-2 sm:px-3">
        <Link href="/auth/signin">
          Sign in
        </Link>
      </Button>
      <Button variant="default" size="sm" asChild className="text-xs sm:text-sm px-2 sm:px-3">
        <Link href="/auth/signup">
          Sign up
        </Link>
      </Button>
    </div>
  );
} 