import type { ReactNode } from 'react';
import FlameWrap from './canvasui/FlameWrap';

export default function PinnedFlameWrap({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <FlameWrap
    color={[1, 0.26, 0.04]}
    intensity={0.78}
    height={32}
    spread={7}
    radius={26}
    speed={0.78}
    scale={0.72}
    turbulence={0.48}
    turbulenceScale={0.65}
    turbulenceReach={12}
    sparks={0.7}
    sparkSize={0.28}
    sparkDensity={0.7}
    sparkSpeed={0.8}
    rim={1.8}
    melt={1.4}
    distortion={2}
    smoke={0}
    ember={1}
    scorch={0}
    style={{ width: '100%', ...style }}
  >{children}</FlameWrap>;
}
