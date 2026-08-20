"use client";

import { useEffect, useRef } from "react";

export default function AutoPrintClient() {
  const didPrint = useRef(false);

  useEffect(() => {
    if (didPrint.current) return;
    didPrint.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => window.clearTimeout(timer);
  }, []);

  // Scoped to this route only (was previously inherited from a global
  // print rule in globals.css). Matches the portrait page size already
  // used by the in-app Misc Estimates print view for consistency.
  return (
    <style>{`@page { size: auto; margin: 0.38in; }`}</style>
  );
}
