import { useState, useEffect, useRef, useCallback } from 'react';
import { Text, Platform, View } from 'react-native';
import { BrailleCanvas } from './BrailleCanvas';
import { ANIMAL_RENDERERS, ANIMAL_COLORS, ANIMAL_LABELS } from './animals';
import type { AnimalType } from './animals';

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

const SIZES = {
  full: { charWidth: 44, charHeight: 26, fontSize: 10 },
  mini: { charWidth: 22, charHeight: 13, fontSize: 6 },
  chat: { charWidth: 14, charHeight: 8, fontSize: 5 },
} as const;

const FPS_CAP = 30;
const FRAME_TIME = 1000 / FPS_CAP;

interface SpiritAnimalProps {
  animal: AnimalType;
  size?: 'full' | 'mini' | 'chat';
  showLabel?: boolean;
  animated?: boolean;
}

export function SpiritAnimal({ animal, size = 'full', showLabel = false, animated = true }: SpiritAnimalProps) {
  const sizeConfig = SIZES[size];
  const [frame, setFrame] = useState('');
  const canvasRef = useRef<BrailleCanvas | null>(null);
  const timeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  const renderer = ANIMAL_RENDERERS[animal];
  const color = ANIMAL_COLORS[animal];

  const renderFrame = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = new BrailleCanvas(sizeConfig.charWidth, sizeConfig.charHeight);
    }
    const canvas = canvasRef.current;
    canvas.clear();
    renderer(canvas, timeRef.current);
    setFrame(canvas.render());
  }, [renderer, sizeConfig.charWidth, sizeConfig.charHeight]);

  useEffect(() => {
    // Create canvas for this size
    canvasRef.current = new BrailleCanvas(sizeConfig.charWidth, sizeConfig.charHeight);

    if (!animated) {
      // Static: render single frame at t=0
      timeRef.current = 0;
      renderFrame();
      return;
    }

    // Animated loop
    const tick = (now: number) => {
      const delta = now - lastFrameRef.current;
      if (delta >= FRAME_TIME) {
        lastFrameRef.current = now;
        timeRef.current += delta / 1000;
        renderFrame();
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [animated, renderFrame, sizeConfig.charWidth, sizeConfig.charHeight]);

  return (
    <View>
      <Text
        style={{
          fontFamily: monoFont,
          fontSize: sizeConfig.fontSize,
          lineHeight: sizeConfig.fontSize * 1.15,
          color,
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 3,
        }}
      >
        {frame}
      </Text>
      {showLabel && (
        <Text
          style={{
            fontFamily: monoFont,
            fontSize: sizeConfig.fontSize + 2,
            color,
            textAlign: 'center',
            marginTop: 4,
          }}
        >
          {ANIMAL_LABELS[animal]}
        </Text>
      )}
    </View>
  );
}
