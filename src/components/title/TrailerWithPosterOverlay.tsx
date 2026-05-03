"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface TrailerWithPosterOverlayProps {
  trailerKey: string;
  poster?: string;
  title: string;
}

export default function TrailerWithPosterOverlay({
  trailerKey,
  poster,
  title,
}: TrailerWithPosterOverlayProps) {
  const [posterVisible, setPosterVisible] = useState(true);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event === "onStateChange") {
          // YouTube player states: 1 = playing, 3 = buffering → hide poster
          setPosterVisible(data.info !== 1 && data.info !== 3);
        }
      } catch {
        // ignore non-JSON postMessages from other origins
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="relative aspect-video md:aspect-auto md:h-full w-full overflow-hidden rounded-xl">
      <iframe
        src={`https://www.youtube.com/embed/${trailerKey}?enablejsapi=1`}
        title="Trailer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />

      {/* Mobile-only: poster thumbnail overlaid at bottom-left of the video */}
      {poster && (
        <div
          className={[
            "md:hidden absolute bottom-3 left-3",
            "w-14 aspect-[2/3] overflow-hidden rounded-lg shadow-xl ring-1 ring-white/20",
            "transition-opacity duration-300",
            posterVisible ? "opacity-100" : "opacity-0 pointer-events-none",
          ].join(" ")}
        >
          <Image
            src={poster}
            alt={`${title} poster`}
            width={56}
            height={84}
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
