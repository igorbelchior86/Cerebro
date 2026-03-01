'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

interface CerebroLogoProps {
  size?: number;
  priority?: boolean;
  style?: CSSProperties;
}

export default function CerebroLogo({
  size = 36,
  priority = false,
  style,
}: CerebroLogoProps) {
  return (
    <Image
      src="/cerebro-logo.png"
      alt="Cerebro logo"
      width={size}
      height={size}
      priority={priority}
      style={{
        width: size,
        height: size,
        display: 'block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
