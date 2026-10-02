import { Bike, Briefcase, CalendarCheck, Car, Home as HomeIcon, Package, Store } from 'lucide-react';

/**
 * Roles a los que alguien puede pedir entrar desde "¿Quieres formar parte de NeirAPP?" (todos menos administrador y
 * cliente, que es el de siempre). Cada uno pide, además de quién es y cómo contactarlo, la empresa detrás (obligatoria
 * u opcional) y sus datos propios en `fields`. La etiqueta de cada campo es también la clave con la que se guarda y la
 * que ve el administrador, así que debe ser corta (máx. 40 caracteres). Los mismos roles valida la API
 * (`leads/domain/applications.py`).
 */
const CARGO = { label: 'Tu cargo', type: 'select', options: ['Dueño(a)', 'Administrador(a)', 'Empleado(a)'], required: true };

export const JOIN_ROLES = [
  {
    role: 'courier',
    title: 'Repartidor',
    text: 'Lleva los pedidos de las tiendas hasta la puerta de los clientes.',
    Icon: Bike,
    color: '#E8621C',
    company: { label: 'Empresa de mensajería (si trabajas con una)', required: false },
    fields: [
      { label: 'Vehículo', type: 'select', options: ['Moto', 'Bicicleta', 'Carro', 'A pie'], required: true },
      { label: 'Placa', placeholder: 'Ej: ABC12D' },
      { label: 'Barrio o vereda donde vives', required: true },
    ],
  },
  {
    role: 'store_staff',
    title: 'Comerciante',
    text: 'Vende los productos de tu tienda, restaurante o panadería a domicilio.',
    Icon: Store,
    color: '#0f5238',
    company: { label: 'Nombre del negocio', required: true, idLabel: 'NIT (si tiene)' },
    fields: [
      { label: 'Tipo de negocio', type: 'select', options: ['Restaurante', 'Panadería', 'Café', 'Mercado o tienda', 'Droguería', 'Otro'], required: true },
      { label: 'Dirección del local', required: true },
      CARGO,
    ],
  },
  {
    role: 'professional',
    title: 'Profesional',
    text: 'Ofrece tus servicios en el directorio de profesionales de Neira.',
    Icon: Briefcase,
    color: '#E8A92C',
    company: { label: 'Empresa o consultorio (si aplica)', required: false },
    fields: [
      { label: 'Profesión u oficio', placeholder: 'Ej: Abogado, electricista, psicóloga', required: true },
      { label: 'Años de experiencia', type: 'number' },
      { label: 'Tarjeta o registro profesional', placeholder: 'Número, si aplica' },
    ],
  },
  {
    role: 'supplier',
    title: 'Proveedor',
    text: 'Vende tus productos al por mayor a negocios y personas.',
    Icon: Package,
    color: '#3B6E8F',
    company: { label: 'Nombre de la empresa', required: true, idLabel: 'NIT' },
    fields: [
      { label: 'Qué productos vende', placeholder: 'Ej: lácteos, granos, aseo…', required: true },
      { label: 'Ciudad o municipio', required: true },
      CARGO,
    ],
  },
  {
    role: 'hotel',
    title: 'Hotel u hospedaje',
    text: 'Publica tu hotel, finca o casa de huéspedes y recibe reservas.',
    Icon: HomeIcon,
    color: '#B6533C',
    company: { label: 'Nombre del hotel u hospedaje', required: true, idLabel: 'NIT o RNT' },
    fields: [
      { label: 'Dirección', required: true },
      { label: 'Número de habitaciones', type: 'number' },
      CARGO,
    ],
  },
  {
    role: 'venue',
    title: 'Establecimiento',
    text: 'Recibe reservas de mesas, canchas o salones de eventos.',
    Icon: CalendarCheck,
    color: '#C0587A',
    company: { label: 'Nombre del establecimiento', required: true, idLabel: 'NIT (si tiene)' },
    fields: [
      { label: 'Tipo de lugar', type: 'select', options: ['Restaurante', 'Cancha', 'Salón de eventos', 'Bar', 'Otro'], required: true },
      { label: 'Dirección', required: true },
      CARGO,
    ],
  },
  {
    role: 'driver',
    title: 'Conductor de motocarro',
    text: 'Lleva pasajeros por Neira en tu motocarro.',
    Icon: Car,
    color: '#1D8A9C',
    company: { label: 'Cooperativa o empresa (si aplica)', required: false },
    fields: [
      { label: 'Placa del motocarro', placeholder: 'Ej: ABC12D', required: true },
      { label: 'Modelo y año', placeholder: 'Ej: Bajaj RE 2021' },
      { label: 'El vehículo es', type: 'select', options: ['Propio', 'De un tercero'], required: true },
    ],
  },
];

export const joinRoleTitle = (role) => JOIN_ROLES.find((r) => r.role === role)?.title ?? role;
