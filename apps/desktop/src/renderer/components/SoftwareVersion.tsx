import { useEffect, useState } from 'react';

export function SoftwareVersion() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.aboutService
      .getAbout()
      .then(({ version: applicationVersion }) => {
        if (active) {
          setVersion(applicationVersion);
        }
      })
      .catch(() => {
        if (active) {
          setVersion(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return version ? <p className="software-version">Version {version}</p> : null;
}
