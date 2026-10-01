const leafPath = 'M30 0 C60 30 60 70 30 100 C0 70 0 30 30 0 Z';

/** Hoja decorativa con nervadura central que se desvanece hacia la punta. */
export const Leaf = ({ fill, style }) => (
  <svg className="leaf" viewBox="0 0 60 100" style={style} aria-hidden="true">
    <path d={leafPath} fill={fill} />
    <defs>
      <linearGradient id="vein" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity=".38" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M30 98 C26.5 78 28.2 36 30 6 C31.8 36 33.5 78 30 98 Z" fill="url(#vein)" />
  </svg>
);
