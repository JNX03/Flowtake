import { useId, useMemo, useState } from "react";
import { ProductVideo } from "./ProductVideo.jsx";

export function FeatureShowcase({ group }) {
  const titleId = useId();
  const firstFeatureId = group.features[0]?.id;
  const [selectedId, setSelectedId] = useState(firstFeatureId);
  const selected = useMemo(
    () => group.features.find((feature) => feature.id === selectedId) ?? group.features[0],
    [group.features, selectedId],
  );

  if (!selected) return null;

  const videoId = `${group.id}-${selected.id}-video`;

  return (
    <section className="feature-showcase" id={group.id} aria-labelledby={titleId}>
      <header className="feature-showcase__heading">
        <p>{group.label}</p>
        <h2 id={titleId}>{group.title}</h2>
        <span>{group.description}</span>
      </header>

      <div className="feature-showcase__layout">
        <div className="feature-showcase__media" aria-live="polite">
          <ProductVideo
            key={selected.id}
            id={videoId}
            active
            autoPlay
            label={selected.media.label}
            poster={selected.media.poster}
            webmSrc={selected.media.webm}
            mp4Src={selected.media.mp4}
            captionsSrc={selected.media.captions}
          />
        </div>

        <div className="feature-showcase__choices" aria-label={`${group.title} features`}>
          {group.features.map((feature, index) => {
            const isSelected = feature.id === selected.id;
            return (
              <button
                key={feature.id}
                className="feature-showcase__choice"
                type="button"
                aria-controls={isSelected ? videoId : undefined}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(feature.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{feature.title}</strong>
                <small>{feature.body}</small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
