import nextIcon from './assets/next.svg';
import previousIcon from './assets/previous.svg';

function pagesAround(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from(
    { length: Math.max(0, end - start + 1) },
    (_, index) => start + index,
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  readonly page: number;
  readonly total: number;
  readonly pageSize: number;
  readonly onChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <footer className="table-footer" aria-label="Pagination du catalogue">
      <p className="result-count">
        {first}-{last} sur {total} fleurs
      </p>
      <nav className="pagination" aria-label="Pages du catalogue">
        <button disabled={page === 1} onClick={() => onChange(page - 1)}>
          <img src={previousIcon} alt="" />
          Précédent
        </button>
        {pagesAround(page, pageCount).map((number) => (
          <button
            key={number}
            className={number === page ? 'current-page' : undefined}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onChange(number)}
          >
            {number}
          </button>
        ))}
        <button
          disabled={page === pageCount}
          onClick={() => onChange(page + 1)}
        >
          Suivant
          <img src={nextIcon} alt="" />
        </button>
      </nav>
      <div className="page-size-area">
        <button
          className="page-size-control"
          type="button"
          aria-label="Nombre de fleurs par page: 25"
          disabled
        >
          25▼
        </button>
      </div>
    </footer>
  );
}
