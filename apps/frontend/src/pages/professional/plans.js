// Planes de suscripción para profesionales. Precios y beneficios provisionales: se ajustan aquí y la
// página /profesional/planes los toma tal cual. `id` también define el color de la tarjeta (verde claro,
// verde NeirAPP y dorado) e `icon` es el nombre del ícono de lucide-react. Los límites reales de cada plan (fotos,
// certificados, solicitudes, destacado) los aplica la API (`professionals/domain/plans.py`): si cambian, cambia ambos.

export const PLANS = [
  {
    id: 'basic',
    icon: 'Sprout',
    tag: 'Plan 1',
    name: 'Básico',
    price: 14900,
    period: 'al mes',
    summary: 'Lo esencial para que la comunidad de Neira sepa que estás aquí.',
    includesTitle: 'Incluye:',
    features: [
      'Perfil profesional con foto y descripción',
      'Aparición en el directorio de tu especialidad',
      'Botones de llamada y WhatsApp',
      'Hasta 3 imágenes en tu galería',
    ],
    audience: 'Ideal si estás empezando y quieres darte a conocer en Neira.',
  },
  {
    id: 'pro',
    icon: 'BriefcaseBusiness',
    tag: 'Plan 2',
    name: 'Profesional',
    recommended: true,
    price: 29900,
    period: 'al mes',
    summary: 'Más visibilidad y herramientas para recibir y organizar tus solicitudes.',
    includesTitle: 'Todo lo del plan Básico, más:',
    features: [
      'Galería de hasta 20 imágenes',
      'Certificados visibles en tu perfil',
      'Insignia de perfil verificado',
    ],
    audience: 'Para profesionales que ya atienden clientes y quieren crecer en Neira.',
  },
  {
    id: 'premium',
    icon: 'Crown',
    tag: 'Plan 3',
    name: 'Premium',
    price: 59900,
    period: 'al mes',
    summary: 'Máxima presencia: destacas primero cuando la gente busca tu especialidad.',
    includesTitle: 'Todo lo del plan Profesional, más:',
    features: [
      'Perfil destacado al inicio de tu especialidad',
      'Galería ilimitada',
      'Aparición en las recomendaciones de la página de inicio',
      'Soporte prioritario del equipo de NeirAPP',
    ],
    audience: 'Para consultorios, firmas y expertos que quieren ser la primera opción.',
  },

  {
    // Plan único con el que arranca NeirAPP: todo lo del Premium por $ 15.000, con 5 fotos en la galería.
    id: 'unico',
    icon: 'BriefcaseBusiness',
    tag: 'Plan NeirAPP',
    name: 'Profesional NeirAPP',
    price: 15000,
    period: 'al mes',
    summary: 'Todo lo que necesitas para que la comunidad de Neira te encuentre y te contacte.',
    includesTitle: 'Incluye:',
    features: [
      'Perfil profesional con foto y descripción',
      'Aparición en el directorio de tu especialidad',
      'Botones de llamada y WhatsApp',
      'Galería de hasta 5 imágenes',
      'Certificados visibles e insignia de perfil verificado',
      'Perfil destacado al inicio de tu especialidad',
      'Aparición en las recomendaciones de la página de inicio',
    ],
    audience: 'Para todos los profesionales de Neira.',
  },
];

// Planes que se ofrecen hoy. Básico, Profesional y Premium siguen definidos arriba (y quien ya los tenga los
// conserva hasta que venzan) para volver a ofrecerlos más adelante: basta con agregarlos aquí y en
// `AVAILABLE_PLANS` de la API (`professionals/domain/plans.py`).
export const AVAILABLE_PLAN_IDS = ['unico'];
export const AVAILABLE_PLANS = PLANS.filter((p) => AVAILABLE_PLAN_IDS.includes(p.id));

// Planes cuyos profesionales salen en "Profesionales recomendados" del inicio.
export const HOME_RECOMMENDED_PLANS = ['premium', 'unico'];

// Cómo se paga un plan mientras no haya pasarela de pagos: el profesional paga por fuera, escribe el comprobante y el
// administrador lo confirma en "Gestión de profesionales". Llena aquí las cuentas reales de NeirAPP; mientras la
// lista esté vacía, la ventana de pago le dice que el equipo le enviará los datos por WhatsApp.
export const PAYMENT = {
  // Ej: { label: 'Nequi', value: '300 123 4567' }, { label: 'Bancolombia ahorros', value: '123-456789-01' }
  methods: [],
  holder: 'NeirAPP',
};

export const PLAN_DAYS = 30;
