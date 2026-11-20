import appIcon from "../../src-tauri/icons/128x128@2x.png";

interface AppIconProps {
  className?: string;
}

export default function AppIcon({ className = "" }: AppIconProps) {
  return (
    <img
      src={appIcon}
      alt="Peek 应用图标"
      width={256}
      height={256}
      draggable={false}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
