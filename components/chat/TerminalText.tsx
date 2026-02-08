import { useState, useEffect, useRef, useCallback } from 'react';
import { Text, Platform } from 'react-native';
import { colors } from '../../constants/theme';

interface TerminalTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  style?: any;
}

const CURSOR = '\u2588'; // █ block cursor
const CURSOR_COLOR = colors.accent; // #7B61FF purple
const FLASH_COLOR = '#B388FF'; // light purple flash

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

export function TerminalText({ text, speed = 20, onComplete, style }: TerminalTextProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const cursorInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charIndex = useRef(0);

  // Adaptive speed based on text length
  const effectiveSpeed = text.length > 500 ? 10 : text.length > 300 ? 15 : speed;

  // Skip to end (called when component unmounts or user sends new message)
  const skipToEnd = useCallback(() => {
    if (typeTimeout.current) clearTimeout(typeTimeout.current);
    if (cursorInterval.current) clearInterval(cursorInterval.current);
    charIndex.current = text.length;
    setDisplayedLength(text.length);
    setIsComplete(true);
    setShowCursor(false);
  }, [text.length]);

  useEffect(() => {
    charIndex.current = 0;
    setDisplayedLength(0);
    setIsComplete(false);
    setShowCursor(true);

    const typeNext = () => {
      if (charIndex.current < text.length) {
        charIndex.current++;
        setDisplayedLength(charIndex.current);

        // Variable speed: faster for spaces, slower for punctuation
        let nextDelay = effectiveSpeed;
        const nextChar = text[charIndex.current];
        if (nextChar === ' ') nextDelay = effectiveSpeed * 0.5;
        else if (nextChar === '.' || nextChar === '!' || nextChar === '?') nextDelay = effectiveSpeed * 3;
        else if (nextChar === ',') nextDelay = effectiveSpeed * 2;
        else if (nextChar === '\n') nextDelay = effectiveSpeed * 4;

        typeTimeout.current = setTimeout(typeNext, nextDelay);
      } else {
        setIsComplete(true);
        setShowCursor(false);
        if (cursorInterval.current) clearInterval(cursorInterval.current);
        onComplete?.();
      }
    };

    typeTimeout.current = setTimeout(typeNext, effectiveSpeed);

    // Cursor blink
    cursorInterval.current = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => {
      if (typeTimeout.current) clearTimeout(typeTimeout.current);
      if (cursorInterval.current) clearInterval(cursorInterval.current);
    };
  }, [text]);

  // Expose skipToEnd via a global registry so parent can call it
  useEffect(() => {
    TerminalText._skipCurrent = skipToEnd;
    return () => {
      if (TerminalText._skipCurrent === skipToEnd) {
        TerminalText._skipCurrent = null;
      }
    };
  }, [skipToEnd]);

  const displayed = text.slice(0, displayedLength);

  return (
    <Text style={[{ fontFamily: monoFont, fontSize: 14, lineHeight: 20 }, style]}>
      {/* Already settled text */}
      {displayed.length > 1 ? displayed.slice(0, -1) : ''}
      {/* Last character with flash color */}
      {displayed.length > 0 && (
        <Text style={{ color: isComplete ? undefined : FLASH_COLOR }}>
          {displayed[displayed.length - 1]}
        </Text>
      )}
      {/* Blinking cursor */}
      {!isComplete && showCursor && (
        <Text style={{ color: CURSOR_COLOR }}>{CURSOR}</Text>
      )}
    </Text>
  );
}

// Static method to skip current animation from outside
TerminalText._skipCurrent = null as (() => void) | null;

export function skipCurrentAnimation() {
  TerminalText._skipCurrent?.();
}
