import { Banknote, Smartphone, Wallet } from 'lucide-react';

// Medios de pago disponibles en NeirAPP.
export const PROVIDERS = {
  nequi: {
    id: 'nequi',
    label: 'Nequi',
    short: 'Nequi',
    description: 'Recibes una notificación en tu app Nequi y apruebas el pago desde el celular.',
    Icon: Smartphone,
    color: '#DA0081',
  },
  mercadopago: {
    id: 'mercadopago',
    label: 'Mercado Pago',
    short: 'Mercado Pago',
    description: 'Pagas en Mercado Pago con tarjeta, PSE o el saldo de tu cuenta.',
    Icon: Wallet,
    color: '#009EE3',
  },
  cash: {
    id: 'cash',
    label: 'Efectivo contra entrega',
    short: 'Efectivo',
    description: 'Pagas en efectivo al recibir tu pedido.',
    Icon: Banknote,
    color: '#236B4A',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

/** Celular colombiano: 10 dígitos que empiezan por 3. */
export const isValidNequiPhone = (value) => /^3\d{9}$/.test(value.replace(/\D/g, ''));

export const maskPhone = (value) => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `··· ··· ${digits.slice(-4)}` : digits;
};
