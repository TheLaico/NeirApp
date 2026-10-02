/**
 * Ilustración de la portada de MarquetNeira: montañas, sol, un sofá verde con su cojín, lámpara y plantas.
 * Es SVG para no depender de una imagen; si llega la ilustración final, se cambia aquí.
 */
export default function HeroArt() {
  return (
    <svg className="mq-hero-art" viewBox="0 0 460 210" aria-hidden="true">
      <defs>
        <linearGradient id="mq-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf7e4" />
          <stop offset="1" stopColor="#eef3df" />
        </linearGradient>
        <linearGradient id="mq-sofa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7a4c" />
          <stop offset="1" stopColor="#1b5a37" />
        </linearGradient>
        <linearGradient id="mq-arm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#27693f" />
          <stop offset="1" stopColor="#164a2d" />
        </linearGradient>
      </defs>
      <ellipse cx="250" cy="120" rx="230" ry="95" fill="url(#mq-sky)" />
      <circle cx="205" cy="70" r="34" fill="#f6c94a" opacity=".85" />
      <path d="M40 150 L120 70 L175 118 L235 58 L320 135 L380 92 L450 150 Z" fill="#a9cf96" opacity=".75" />
      <path d="M20 165 L95 112 L150 140 L215 98 L290 150 L360 120 L460 168 Z" fill="#7fb26c" opacity=".8" />
      <ellipse cx="250" cy="190" rx="215" ry="16" fill="#cfe0bf" />

      {/* Lámpara de pie */}
      <rect x="345" y="70" width="4" height="112" rx="2" fill="#5b4a37" />
      <path d="M325 40 L369 40 L380 76 L314 76 Z" fill="#c98a4a" />
      <ellipse cx="347" cy="184" rx="18" ry="4" fill="#5b4a37" />

      {/* Sofá */}
      <rect x="150" y="98" width="190" height="50" rx="18" fill="url(#mq-sofa)" />
      <rect x="138" y="128" width="214" height="40" rx="14" fill="url(#mq-sofa)" />
      <rect x="128" y="112" width="34" height="62" rx="14" fill="url(#mq-arm)" />
      <rect x="328" y="112" width="34" height="62" rx="14" fill="url(#mq-arm)" />
      <rect x="166" y="132" width="78" height="20" rx="8" fill="#2b7247" />
      <rect x="248" y="132" width="78" height="20" rx="8" fill="#2b7247" />
      <rect x="282" y="104" width="40" height="34" rx="9" fill="#f2c14e" transform="rotate(10 302 121)" />
      <rect x="150" y="174" width="8" height="12" rx="2" fill="#5b4a37" />
      <rect x="332" y="174" width="8" height="12" rx="2" fill="#5b4a37" />

      {/* Plantas */}
      <path d="M95 182 L88 150 L118 150 L111 182 Z" fill="#c98a4a" />
      <path d="M103 152 C90 125 70 118 62 98 C84 104 98 122 103 152 Z" fill="#3f8f4f" />
      <path d="M103 152 C104 118 116 98 132 86 C130 112 118 130 103 152 Z" fill="#2d7a3d" />
      <path d="M103 152 C112 132 132 126 146 128 C134 140 120 148 103 152 Z" fill="#8cc56b" />
      <path d="M103 152 C96 140 86 132 72 130 C82 142 92 148 103 152 Z" fill="#e8a92c" />
      <path d="M402 184 L396 158 L420 158 L414 184 Z" fill="#c98a4a" />
      <path d="M408 160 C400 140 404 118 414 104 C420 124 418 144 408 160 Z" fill="#2d7a3d" />
      <path d="M408 160 C418 146 432 142 446 144 C436 154 424 160 408 160 Z" fill="#5a9a4a" />
    </svg>
  );
}
