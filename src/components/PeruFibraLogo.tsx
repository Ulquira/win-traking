import logoColor from '@/assets/logo.png';
import logoWhite from '@/assets/logo-white.png';

interface MainLogoProps {
  className?: string;
  white?: boolean;
}

export const MainLogo = ({ className = '', white = false }: MainLogoProps) => {
  return (
    <img 
      src={white ? logoWhite : logoColor} 
      alt="Winet" 
      className={`object-contain ${className}`}
    />
  );
};
