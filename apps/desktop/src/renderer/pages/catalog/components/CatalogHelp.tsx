import { useRef, useState } from 'react';
import collapseIcon from '@renderer/assets/collapse.svg';
import downloadIcon from '@renderer/assets/download.svg';
import expandIcon from '@renderer/assets/expand.svg';
import helpIcon from '@renderer/assets/help.svg';
import { useCloseOnOutsidePointer } from '@renderer/hooks/useCloseOnOutsidePointer';

export function CatalogHelp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useCloseOnOutsidePointer(menu, menuOpen, () => setMenuOpen(false));

  const downloadTemplate = async (): Promise<void> => {
    const csv = await window.catalogManagementService.getTemplate();
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const download = document.createElement('a');
    download.href = url;
    download.download = 'template_catalog.csv';
    download.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  return (
    <div ref={menu} className="catalog-menu">
      <button
        className="secondary-button catalog-help-button"
        type="button"
        aria-label="Aide"
        aria-expanded={menuOpen}
        aria-controls="catalog-help-options"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <img src={helpIcon} alt="" />
        <img src={menuOpen ? collapseIcon : expandIcon} alt="" />
      </button>
      {menuOpen ? (
        <div id="catalog-help-options" className="catalog-menu-options">
          <button type="button" onClick={() => void downloadTemplate()}>
            <img src={downloadIcon} alt="" />
            Télécharger le modèle du catalogue
          </button>
        </div>
      ) : null}
    </div>
  );
}
