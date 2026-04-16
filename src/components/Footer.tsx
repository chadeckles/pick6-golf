"use client";

import { CURRENT_YEAR } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-t-primary-dark text-white/50 py-6">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <p>Pick Six Golf © {CURRENT_YEAR}</p>
        <p>Live scoring powered by ESPN • Rankings via OWGR</p>
      </div>
      <div className="max-w-5xl mx-auto px-4 mt-3 text-center">
        <p className="text-white/25 text-[10px] leading-relaxed max-w-3xl mx-auto">
          Pick Six Golf is an independent fan-operated platform for recreational entertainment purposes only. It is not affiliated with, endorsed by, or in any way officially connected to Augusta National Golf Club, the PGA of America, the PGA Tour, the United States Golf Association (USGA), The R&amp;A, the DP World Tour, or any of their subsidiaries, affiliates, or governing bodies. All tournament names, logos, and trademarks are the property of their respective owners and are used here solely for identification purposes. No gambling services are provided.
        </p>
      </div>
    </footer>
  );
}
