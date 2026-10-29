"use client";

import Image from "next/image";
import { useState } from "react";

/** Client logo image; falls back to the name as text if the image fails to load. */
export function LogoMark({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{name}</>;
  return (
    <span className="relative block h-8 w-28 overflow-hidden rounded-md">
      <Image
        src={src}
        alt={name}
        fill
        sizes="112px"
        onError={() => setFailed(true)}
        className="object-contain grayscale transition-[filter] group-hover:grayscale-0"
      />
    </span>
  );
}
