import appLogo from '../assets/app-logo.png';
import { APP_NAME } from '../lib/branding';

type AppLogoProps = {
  size?: 'sm' | 'md';
  className?: string;
};

// [AI-GEN] scope:AppLogo, model:auto, reviewed:false
export function AppLogo({ size = 'md', className = '' }: AppLogoProps) {
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  return (
    <img
      src={appLogo}
      alt={APP_NAME}
      draggable={false}
      className={`shrink-0 rounded-[22%] object-cover shadow-sm ring-1 ring-black/5 ${dimension} ${className}`}
    />
  );
}
// [/AI-GEN]
