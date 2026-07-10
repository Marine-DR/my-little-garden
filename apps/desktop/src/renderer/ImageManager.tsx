import { useRef, useState } from 'react';
import collapseIcon from './assets/collapse.svg';
import expandIcon from './assets/expand.svg';
import { useCloseOnOutsidePointer } from './useCloseOnOutsidePointer';

export function ImageManager({
  onImported,
  onSuccess,
}: {
  readonly onImported: () => void;
  readonly onSuccess: (message: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const imageInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useCloseOnOutsidePointer(menu, menuOpen, () => setMenuOpen(false));

  const importFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.length === 0) {
      return;
    }
    setBusy(true);
    setMenuOpen(false);
    setErrors([]);
    try {
      const files = await Promise.all(
        selected.map(async (file) => ({
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        })),
      );
      const result = await window.catalogApi.importPhotos(files);
      if (!result.ok) {
        setErrors(result.errors.map(({ message }) => message));
        return;
      }
      onImported();
      const warning = result.unmatched.length
        ? ` ${result.unmatched.length} image(s) sans correspondance : ${result.unmatched.join(', ')}.`
        : '';
      onSuccess(
        `${result.imported} photo(s) importée(s) avec succès.${warning}`,
      );
    } catch (error) {
      console.error('Photo import failed', error);
      setErrors(['Les images n’ont pas pu être importées.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div ref={menu} className="catalog-menu">
        <button
          className="secondary-button"
          type="button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          disabled={busy}
        >
          <span aria-hidden="true">🖼</span>
          Importer des images
          <img src={menuOpen ? collapseIcon : expandIcon} alt="" />
        </button>
        {menuOpen ? (
          <div className="catalog-menu-options image-menu-options">
            <button type="button" onClick={() => imageInput.current?.click()}>
              Importer une image
            </button>
            <button type="button" onClick={() => zipInput.current?.click()}>
              Importer plusieurs images (.zip)
            </button>
          </div>
        ) : null}
        <input
          ref={imageInput}
          className="visually-hidden"
          aria-label="Sélectionner une image"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={(event) => void importFiles(event)}
        />
        <input
          ref={zipInput}
          className="visually-hidden"
          aria-label="Sélectionner un fichier ZIP"
          type="file"
          accept=".zip,application/zip"
          onChange={(event) => void importFiles(event)}
        />
      </div>
      {errors.length ? (
        <div className="error-banner image-import-banner" role="alert">
          {errors.join(' ')}
        </div>
      ) : null}
    </>
  );
}
