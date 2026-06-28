"use client";

import { useState } from "react";

/** Card image with graceful fallback when the source is missing or 404s. */
export function CardImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="h-full w-full grid place-items-center text-[#82858c] text-xs">kein Bild</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />
  );
}
