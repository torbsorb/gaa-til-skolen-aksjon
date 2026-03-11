import { useEffect, useState } from 'react';

import { getClassLogo } from './classLogos';

function ClassLogo({ className, size = 36 }) {
  const [isOpen, setIsOpen] = useState(false);
  const imageSrc = getClassLogo(className);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Vis ${className}-logo i fullskjerm`}
        style={{
          padding: 0,
          margin: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'zoom-in',
          lineHeight: 0,
          borderRadius: 12,
        }}
      >
        <img
          src={imageSrc}
          alt={`${className} logo`}
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            objectFit: 'cover',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
          }}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${className} logo`}
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 18, 24, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Lukk bilde"
            style={{
              position: 'fixed',
              top: 18,
              right: 18,
              width: 48,
              height: 48,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 28,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <img
              src={imageSrc}
              alt={`${className} logo`}
              style={{
                display: 'block',
                width: 'min(92vw, 960px)',
                maxHeight: '78vh',
                height: 'auto',
                borderRadius: 24,
                boxShadow: '0 28px 70px rgba(0,0,0,0.35)',
                background: '#fff',
              }}
            />
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, textAlign: 'center' }}>
              {className}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ClassLogo;
