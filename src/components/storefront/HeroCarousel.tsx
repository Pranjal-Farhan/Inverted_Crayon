"use client";

import { useEffect, useState } from "react";

export function HeroCarousel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % images.length), 4500);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {images.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-[6] flex -translate-x-1/2 gap-1.5">
          {images.map((url, i) => (
            <button
              key={url}
              onClick={() => setActive(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-lime" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
