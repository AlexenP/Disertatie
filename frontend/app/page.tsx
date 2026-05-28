"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {getCurrentUser} from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    router.replace(user ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
      Se deschide aplicatia...
    </div>
  );
}
