import { FeatureShowcase } from "./FeatureShowcase.jsx";
import { ProductVideo } from "./ProductVideo.jsx";
import {
  hasReviewedDemoMedia,
  reviewedDemoMedia,
} from "../reviewedDemoMedia.js";

const assetUrl = (asset) => (
  asset ? `${import.meta.env.BASE_URL}assets/${asset.path}` : undefined
);

const mediaProps = (entry) => ({
  captionsSrc: assetUrl(entry.media.captions),
  downloadSrc: assetUrl(entry.media.mp4),
  label: entry.label,
  mp4Src: assetUrl(entry.media.mp4),
  poster: assetUrl(entry.media.poster),
  webmSrc: assetUrl(entry.media.webm),
});

export function ReviewedHeroVideo() {
  if (!hasReviewedDemoMedia) return null;

  const master = reviewedDemoMedia.master;

  return (
    <aside className="reviewed-hero-video" id="demo" aria-label="Genuine Flowtake product demo">
      <div className="reviewed-hero-video__meta">
        <span>Genuine Flowtake v{reviewedDemoMedia.releaseVersion} footage</span>
        <span>{master.durationSeconds}-second walkthrough</span>
      </div>
      <ProductVideo
        {...mediaProps(master)}
        id="flowtake-product-demo"
        autoPlay
        loop={false}
        downloadLabel="Download the Flowtake product demo"
      />
      <p className="reviewed-hero-video__note">
        Privacy-reviewed product footage showing the real Record, Edit, and Export workflow.
      </p>
    </aside>
  );
}

export function ReviewedDemoShowcase() {
  if (!hasReviewedDemoMedia) return null;

  const group = {
    id: "demo-features",
    label: "Genuine product footage",
    title: "See the workflow step by step.",
    description: "Switch between the reviewed Record, Edit, and Export clips from the same Flowtake demo source.",
    features: reviewedDemoMedia.features.map((feature) => ({
      id: feature.id,
      title: feature.title,
      body: feature.body,
      media: {
        captions: assetUrl(feature.media.captions),
        download: assetUrl(feature.media.mp4),
        label: feature.label,
        mp4: assetUrl(feature.media.mp4),
        poster: assetUrl(feature.media.poster),
        webm: assetUrl(feature.media.webm),
      },
    })),
  };

  return <FeatureShowcase group={group} />;
}
