import type { ReactNode } from "react";

interface ThreeColumnLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ThreeColumnLayout({ left, center, right }: ThreeColumnLayoutProps) {
  return (
    <div className="three-column-layout">
      <div className="left-panel">
        {left}
        {center}
      </div>
      <div className="right-panel">
        {right}
      </div>
    </div>
  );
}
