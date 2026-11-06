import logoColor from '@/assets/win_logo_png.png';
import logoWhite from '@/assets/win_logo_png.png';

interface MainLogoProps {
  className?: string;
  white?: boolean;
}

export const MainLogo = ({ className = '', white = false }: MainLogoProps) => {
  return (
    <img 
      src={white ? logoWhite : logoColor} 
      alt="Winet" 
      className={`object-contain ${className} ${white ? 'brightness-0 invert' : ''}`}
    />
  );
};
