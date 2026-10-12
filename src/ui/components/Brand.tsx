import packageJson from '../../../package.json';

/** RSOFT logo mark: a stylized "R" in brand blue on a transparent field. */
export const RsoftLogo = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    role="img"
    aria-label="RSOFT"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="48" height="48" rx="10" fill="#0B1F3B" />
    <path
      d="M15 12h12a8 8 0 0 1 2 15.7L35 36h-6l-5.2-7.6H21V36h-6V12Zm6 5v6h6a3 3 0 0 0 0-6h-6Z"
      fill="#007BFF"
    />
  </svg>
);

export const BrandHeader = ({ title }: { title: string }) => (
  <header className="brand-header">
    <div className="brand-mark">
      <RsoftLogo size={36} />
      <span className="brand-name">RSOFT</span>
    </div>
    <span className="brand-title">{title}</span>
  </header>
);

export const BrandFooter = () => (
  <footer className="brand-footer">
    <span>RSOFT · Simulador de Dosagem</span>
    <span>v{packageJson.version}</span>
  </footer>
);
