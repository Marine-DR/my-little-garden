import catalogIcon from '../assets/catalog.svg';
import flowerbedIcon from '../assets/flowerbed.svg';
import listIcon from '../assets/list.svg';
import appIcon from '../assets/app-icon.png';

export type AppScreen = 'catalog' | 'selections' | 'flowerbeds';

const NAVIGATION_ACTIONS: Record<
  AppScreen,
  {
    readonly icon: string;
    readonly label: string;
  }
> = {
  catalog: {
    icon: catalogIcon,
    label: 'Mon Catalogue',
  },
  selections: {
    icon: listIcon,
    label: 'Mes Sélections',
  },
  flowerbeds: {
    icon: flowerbedIcon,
    label: 'Mes Parterres',
  },
};

export function AppHeader({
  screen,
  onScreenChange,
}: {
  readonly screen: AppScreen;
  readonly onScreenChange: (screen: AppScreen) => void;
}) {
  return (
    <header className="app-header">
      <a
        className="brand"
        href="#catalog-table"
        aria-label="MyLittleGarden, catalogue"
        onClick={() => onScreenChange('catalog')}
      >
        <img src={appIcon} alt="" />
        MyLittleGarden
      </a>
      <nav aria-label="Navigation principale">
        {(Object.keys(NAVIGATION_ACTIONS) as AppScreen[])
          .filter((target) => target !== screen)
          .map((target) => {
            const action = NAVIGATION_ACTIONS[target];
            return (
              <button
                key={target}
                className="primary-button"
                type="button"
                onClick={() => onScreenChange(target)}
              >
                {target === 'flowerbeds' ? (
                  <span
                    className="flowerbed-icon"
                    aria-hidden="true"
                    style={{
                      maskImage: `url("${action.icon}")`,
                      WebkitMaskImage: `url("${action.icon}")`,
                    }}
                  />
                ) : (
                  <img src={action.icon} alt="" />
                )}
                {action.label}
              </button>
            );
          })}
      </nav>
    </header>
  );
}
