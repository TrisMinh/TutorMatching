import type { HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  elevated?: boolean;
};

export function Surface({ children, className = '', elevated = false, ...props }: SurfaceProps) {
  return (
    <section
      className={`tm-surface ${elevated ? 'tm-surface--elevated' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </section>
  );
}
