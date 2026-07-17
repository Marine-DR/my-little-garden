export function SuccessBanner({
  message,
  onClose,
}: {
  readonly message: string;
  readonly onClose: () => void;
}) {
  return (
    <div className="success-banner" role="status">
      <span>{message}</span>
      <button
        type="button"
        aria-label="Fermer le message de succès"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}
