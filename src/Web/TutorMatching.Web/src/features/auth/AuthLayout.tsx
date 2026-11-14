import { useState, type ReactNode } from 'react';
import { BrandMark } from '../../design-system/BrandMark';
import './auth.css';

const tutorSlides = [
  {
    image: '/assets/figma/auth-tutor-03.jpg',
    title: 'Learn better, together.',
  },
  {
    image: '/assets/figma/auth-tutor-02.jpg',
    title: 'Guidance that fits your goals.',
  },
  {
    image: '/assets/figma/auth-tutor-01.jpg',
    title: 'Build confidence, one lesson at a time.',
  },
];

const steps = [
  ['01', 'Find your tutor', 'Browse verified tutors by subject and availability.'],
  ['02', 'Get connected', 'Book a time that works for both of you.'],
  ['03', 'Learn one-to-one', 'Grow with personalized support and feedback.'],
];

type AuthLayoutProps = {
  children: ReactNode;
  screen: string;
  slideNumber: number;
  slideTitle: string;
};

export function Brand() {
  return (
    <a aria-label="Teach. home" className="auth-brand" href="/">
      <BrandMark />
      <span>Teach.</span>
    </a>
  );
}

export function AuthLayout({ children, screen, slideNumber, slideTitle }: AuthLayoutProps) {
  const initialSlide = (slideNumber - 1) % tutorSlides.length;
  const [activeSlide, setActiveSlide] = useState(initialSlide);

  function changeSlide(direction: -1 | 1) {
    setActiveSlide((current) => (current + direction + tutorSlides.length) % tutorSlides.length);
  }

  const previousSlide = (activeSlide + tutorSlides.length - 1) % tutorSlides.length;
  const nextSlide = (activeSlide + 1) % tutorSlides.length;

  return (
    <main className={`auth-page auth-page--${screen}`}>
      <section className="auth-entry">
        <header className="auth-entry__header">
          <Brand />
          <a className="auth-help" href="mailto:support@teach.vn">
            Need help?
          </a>
        </header>
        <div className="auth-entry__content">{children}</div>
        <div className="auth-mobile-photo" aria-hidden="true">
          <img alt="" src={tutorSlides[activeSlide].image} />
        </div>
        <footer className="auth-entry__footer">
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms of Service</a>
        </footer>
      </section>

      <aside className="auth-showcase" aria-label="TutorMatching introduction">
        <div className="auth-showcase__inner">
          <p className="auth-showcase__badge">TUTOR MATCHING</p>
          <h2>
            Find the right tutor.
            <br />
            <span>Learn your way.</span>
          </h2>
          <p className="auth-showcase__intro">
            Connect with a tutor who fits your subject, learning goals and schedule.
          </p>

          <div className="auth-carousel">
            <div className="auth-carousel__peek auth-carousel__peek--left">
              <img alt="" src={tutorSlides[previousSlide].image} />
            </div>
            <div className="auth-carousel__photo">
              <img alt="Tutor helping a student learn" key={activeSlide} src={tutorSlides[activeSlide].image} />
            </div>
            <div className="auth-carousel__peek auth-carousel__peek--right">
              <img alt="" src={tutorSlides[nextSlide].image} />
            </div>
          </div>

          <div className="auth-showcase__story">
            <div>
              <h3>{slideTitle || tutorSlides[activeSlide].title}</h3>
              <p>Personalized guidance, flexible schedules, real progress.</p>
            </div>
            <p className="auth-showcase__counter">
              <strong>{slideNumber}</strong> / 9
            </p>
          </div>

          <div className="auth-showcase__controls">
            <div className="auth-showcase__dots" aria-hidden="true">
              {tutorSlides.map((_, index) => (
                <span className={index === activeSlide ? 'is-active' : ''} key={index} />
              ))}
            </div>
            <div className="auth-showcase__arrows">
              <button aria-label="Previous slide" onClick={() => changeSlide(-1)} type="button">
                <span aria-hidden="true">←</span>
              </button>
              <button aria-label="Next slide" onClick={() => changeSlide(1)} type="button">
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="auth-showcase__steps">
            {steps.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>

          <p className="auth-showcase__note">A better match makes every lesson count.</p>
        </div>
      </aside>
    </main>
  );
}
