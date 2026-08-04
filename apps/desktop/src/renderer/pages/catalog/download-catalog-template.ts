export async function downloadCatalogTemplate(): Promise<void> {
  const csv = await window.catalogManagementService.getTemplate();
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const download = document.createElement('a');
  download.href = url;
  download.download = 'template_catalog.csv';
  download.click();
  URL.revokeObjectURL(url);
}
