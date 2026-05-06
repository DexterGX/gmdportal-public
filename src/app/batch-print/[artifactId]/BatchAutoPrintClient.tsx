"use client";

import { useEffect, useRef } from "react";

export default function BatchAutoPrintClient() {
  const didPrint = useRef(false);

  useEffect(() => {
    if (didPrint.current) return;
    didPrint.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
