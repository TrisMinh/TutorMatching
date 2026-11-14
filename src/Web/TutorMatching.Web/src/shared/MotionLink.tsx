import { flushSync } from 'react-dom';
import { useCallback, type MouseEvent } from 'react';
import {
  Link,
  NavLink,
  useNavigate,
  type LinkProps,
  type NavigateOptions,
  type NavLinkProps,
  type To,
} from 'react-router-dom';

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

function shouldHandle(event: MouseEvent<HTMLAnchorElement>, target?: string) {
  return !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && (!target || target === '_self');
}

export function useMotionNavigate() {
  const navigate = useNavigate();

  return useCallback((to: To, options?: NavigateOptions) => {
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transitionDocument = document as ViewTransitionDocument;
    const performNavigation = () => navigate(to, { ...options, viewTransition: false });

    if (!reducedMotion && transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => flushSync(performNavigation));
      return;
    }
    performNavigation();
  }, [navigate]);
}

export function MotionLink({ onClick, reloadDocument, target, viewTransition: _viewTransition, ...props }: LinkProps) {
  const navigate = useMotionNavigate();
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (reloadDocument || !shouldHandle(event, target)) return;
        event.preventDefault();
        navigate(props.to, {
          preventScrollReset: props.preventScrollReset,
          relative: props.relative,
          replace: props.replace,
          state: props.state,
        });
      }}
      target={target}
    />
  );
}

export function MotionNavLink({ onClick, reloadDocument, target, viewTransition: _viewTransition, ...props }: NavLinkProps) {
  const navigate = useMotionNavigate();
  return (
    <NavLink
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (reloadDocument || !shouldHandle(event, target)) return;
        event.preventDefault();
        navigate(props.to, {
          preventScrollReset: props.preventScrollReset,
          relative: props.relative,
          replace: props.replace,
          state: props.state,
        });
      }}
      target={target}
    />
  );
}
