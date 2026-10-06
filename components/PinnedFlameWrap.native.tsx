import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const AnimatedView = Animated.View;
const FLAME_REACH = 32;

export default function PinnedFlameWrap({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  const flicker = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      flicker.setValue(0.9);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(flicker, { toValue: 0.74, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [flicker, reduceMotion]);

  const flames = useMemo(() => {
    if (!size.width) return [];
    const count = Math.max(3, Math.floor((size.width - 24) / 17));
    const gap = (size.width - 24) / count;
    return Array.from({ length: count }, (_, index) => {
      const x = 12 + gap * index + gap * 0.12;
      const flameWidth = gap * 0.84;
      const base = FLAME_REACH + 5;
      const peak = 9 + ((index * 7) % 12);
      const outer = `M ${x} ${base} C ${x - 2} ${base - 9} ${x + 5} ${peak + 9} ${x + flameWidth * 0.38} ${peak} C ${x + flameWidth * 0.48} ${peak + 8} ${x + flameWidth * 0.25} ${base - 4} ${x + flameWidth * 0.56} ${base - 10} C ${x + flameWidth * 0.54} ${base - 1} ${x + flameWidth + 2} ${base - 7} ${x + flameWidth} ${base} Z`;
      const inner = `M ${x + flameWidth * 0.24} ${base} C ${x + flameWidth * 0.3} ${base - 7} ${x + flameWidth * 0.48} ${peak + 12} ${x + flameWidth * 0.58} ${peak + 9} C ${x + flameWidth * 0.7} ${peak + 16} ${x + flameWidth * 0.6} ${base - 4} ${x + flameWidth * 0.82} ${base} Z`;
      return { outer, inner };
    });
  }, [size.width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => current.width === width && current.height === height ? current : { width, height });
  };

  return <View onLayout={onLayout} style={[styles.wrap, style]}>
    {children}
    {size.width > 0 && size.height > 0 && <AnimatedView pointerEvents="none" style={[styles.flameLayer, { opacity: flicker }]}>
      <Svg width={size.width} height={size.height + FLAME_REACH + 8} viewBox={`0 0 ${size.width} ${size.height + FLAME_REACH + 8}`}>
        <Rect x={3} y={FLAME_REACH + 5} width={Math.max(0, size.width - 6)} height={Math.max(0, size.height - 10)} rx={26} fill="none" stroke="#F45A2A" strokeWidth={2.5} opacity={0.9} />
        {flames.map((flame, index) => <Path key={index} d={flame.outer} fill="#F45A2A" opacity={0.92} />)}
        {flames.map((flame, index) => <Path key={index} d={flame.inner} fill="#FFC247" opacity={0.93} />)}
        {flames.filter((_, index) => index % 3 === 1).map((_, index) => {
          const x = 18 + index * 51;
          return <Circle key={index} cx={x % Math.max(size.width, 1)} cy={8 + ((index * 11) % 17)} r={1.8} fill="#FFD765" />;
        })}
      </Svg>
    </AnimatedView>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'visible' },
  flameLayer: { position: 'absolute', top: -FLAME_REACH, left: 0, right: 0 },
});
