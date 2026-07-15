import { useState } from 'react';

export function PlantPhoto({
  name,
  url,
}: {
  readonly name: string;
  readonly url: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) {
    return (
      <span
        className="photo-fallback"
        role="img"
        aria-label={`Aucune photo pour ${name}`}
      >
        🌿
      </span>
    );
  }
  return (
    <img
      className="plant-photo"
      src={url}
      alt={name}
      onError={() => setFailedUrl(url)}
    />
  );
}
