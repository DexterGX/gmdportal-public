"use client";

import { useEffect } from "react";

export default function AutoPrintClient() {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return null;
}
