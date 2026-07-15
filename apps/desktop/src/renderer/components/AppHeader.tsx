import catalogIcon from '../assets/catalog.svg';
import flowerbedIcon from '../assets/flowerbed.png';
import listIcon from '../assets/list.svg';
import appIcon from '../assets/app-icon.png';

export type AppScreen = 'catalog' | 'selections';

const NAVIGATION_ACTIONS: Record<
  AppScreen,
  {
    readonly target: AppScreen;
    readonly icon: string;
    readonly label: string;
  }
> = {
  catalog: {
    target: 'selections',
    icon: listIcon,
    label: 'Mes Sélections',
  },
  selections: {
    target: 'catalog',
    icon: catalogIcon,
    label: 'Mon Catalogue',
  },
};

export function AppHeader({
  screen,
  onScreenChange,
}: {
  readonly screen: AppScreen;
  readonly onScreenChange: (screen: AppScreen) => void;
}) {
  const navigationAction = NAVIGATION_ACTIONS[screen];

  return (
    <header className="app-header">
      <a
        className="brand"
        href="#catalog-table"
        aria-label="MyLittleGarden, catalogue"
      >
        <img src={appIcon} alt="" />
        MyLittleGarden
      </a>
      <nav aria-label="Navigation principale">
        <button
          type="button"
          onClick={() => onScreenChange(navigationAction.target)}
        >
          <img src={navigationAction.icon} alt="" />
          {navigationAction.label}
        </button>
        <button>
          <img src={flowerbedIcon} alt="" />
          Mes Parterres
        </button>
      </nav>
    </header>
  );
}
