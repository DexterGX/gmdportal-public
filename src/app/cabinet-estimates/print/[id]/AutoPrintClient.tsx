"use client";

import { useEffect, useRef } from "react";

export default function AutoPrintClient({ title }: { title?: string }) {
  const didPrint = useRef(false);

  useEffect(() => {
    if (title?.trim()) {
      document.title = title.trim();
    }
  }, [title]);

  useEffect(() => {
    if (didPrint.current) return;
    didPrint.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
