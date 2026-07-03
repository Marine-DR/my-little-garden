import { useState } from 'react';

export function PlantPhoto({
  name,
  url,
}: {
  readonly name: string;
  readonly url: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
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
      onError={() => setFailed(true)}
    />
  );
}
