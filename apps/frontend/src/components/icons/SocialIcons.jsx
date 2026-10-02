// Íconos de redes en su color de marca (lucide ya no trae logos de marcas). Círculos de 1em.

export const FacebookIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="16" fill="#1877f2" />
    <path d="M17.6 26v-8.2h2.8l.4-3.3h-3.2v-2.1c0-.9.3-1.6 1.6-1.6h1.7V7.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4h-2.8v3.3h2.8V26z" fill="#fff" />
  </svg>
);

export const InstagramIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
        <stop offset="0" stopColor="#fdf497" />
        <stop offset=".05" stopColor="#fdf497" />
        <stop offset=".45" stopColor="#fd5949" />
        <stop offset=".6" stopColor="#d6249f" />
        <stop offset=".9" stopColor="#285aeb" />
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="16" fill="url(#ig-grad)" />
    <rect x="9" y="9" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.9" />
    <circle cx="16" cy="16" r="3.4" fill="none" stroke="#fff" strokeWidth="1.9" />
    <circle cx="20.2" cy="11.8" r="1" fill="#fff" />
  </svg>
);

export const WhatsappIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="16" fill="#25d366" />
    <path
      d="M16 7.6a8.3 8.3 0 0 0-7.1 12.6L7.8 24.3l4.2-1.1A8.3 8.3 0 1 0 16 7.6zm0 15.2c-1.3 0-2.6-.4-3.7-1l-.3-.2-2.5.7.7-2.4-.2-.3a6.9 6.9 0 1 1 6 3.2zm3.8-5.1c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1l-.6.8c-.1.1-.2.2-.4.1-.2-.1-.9-.3-1.7-1-.6-.6-1-1.2-1.2-1.4-.1-.2 0-.3.1-.4l.3-.4.2-.4v-.3l-.6-1.5c-.2-.4-.3-.3-.5-.3h-.4c-.1 0-.4 0-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.1 1.6 2.4 3.9 3.4.5.2 1 .4 1.3.5.6.2 1 .1 1.4.1.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1l-.4-.2z"
      fill="#fff"
    />
  </svg>
);
