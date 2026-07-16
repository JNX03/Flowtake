import { useEffect, useRef, useState } from "react";
import "./product-media.css";

export function ProductVideo({
  active = true,
  autoPlay = false,
  captionsSrc,
  downloadLabel = "Download video",
  downloadSrc,
  id,
  label,
  loop = true,
  mp4Src,
  onMediaError,
  poster,
  webmSrc,
}) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const hasSource = Boolean(webmSrc || mp4Src);
  const fallbackSrc = downloadSrc || mp4Src || webmSrc;

  useEffect(() => {
    setFailed(false);
  }, [mp4Src, webmSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!active) {
      video.pause();
      return;
    }

    video.currentTime = 0;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (autoPlay && !reduceMotion) void video.play().catch(() => undefined);
  }, [active, autoPlay, mp4Src, webmSrc]);

  const markFailed = () => {
    setFailed(true);
    onMediaError?.();
  };

  if (!hasSource) {
    return (
      <p className="product-video__error" id={id} role="status">
        Product footage is not available.
      </p>
    );
  }

  if (failed) {
    return (
      <div className="product-video__error" id={id} role="status">
        <p>Product footage could not be loaded.</p>
        {fallbackSrc && (
          <a
            className="product-video__download"
            href={fallbackSrc}
            download
          >
            {downloadLabel}
          </a>
        )}
      </div>
    );
  }

  return (
    <figure className="product-video">
      <video
        ref={videoRef}
        id={id}
        aria-label={label}
        controls
        loop={loop}
        muted
        playsInline
        poster={poster}
        preload="metadata"
        onError={markFailed}
      >
        {webmSrc && <source src={webmSrc} type="video/webm" />}
        {mp4Src && <source src={mp4Src} type="video/mp4" />}
        {captionsSrc && (
          <track src={captionsSrc} kind="captions" srcLang="en" label="English" default />
        )}
      </video>
      <figcaption className="product-media__sr-only">{label}</figcaption>
    </figure>
  );
}
