// Planes de suscripción para profesionales. Precios y beneficios provisionales: se ajustan aquí y la
// página /profesional/planes los toma tal cual. `id` también define el color de la tarjeta (verde claro,
// verde NeirAPP y dorado) e `icon` es el nombre del ícono de lucide-react. Todavía no hay cobro; elegir un plan solo lo marca.

export const PLANS = [
  {
    id: 'basic',
    icon: 'Sprout',
    tag: 'Plan 1',
    name: 'Básico',
    price: 0,
    period: 'Gratis para siempre',
    summary: 'Lo esencial para que la comunidad de Neira sepa que estás aquí.',
    includesTitle: 'Incluye:',
    features: [
      'Perfil profesional con foto y descripción',
      'Aparición en el directorio de tu especialidad',
      'Botones de llamada y WhatsApp',
      'Hasta 3 imágenes en tu galería',
    ],
    audience: 'Ideal si estás empezando o quieres probar NeirAPP sin costo.',
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
      'Gestión de citas y solicitudes de contacto',
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
];
