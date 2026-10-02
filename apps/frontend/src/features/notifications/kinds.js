import { BadgeCheck, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Crown, FileWarning, ReceiptText } from 'lucide-react';

// Íconos y color de los avisos que vienen de la API (citas, certificados y planes de profesionales).
export const SERVER_KINDS = {
  request_new: { Icon: CalendarPlus, tone: 'new' },
  request_scheduled: { Icon: CalendarCheck, tone: 'good' },
  request_rescheduled: { Icon: CalendarClock, tone: 'info' },
  request_rejected: { Icon: CalendarX, tone: 'bad' },
  request_cancelled: { Icon: CalendarX, tone: 'bad' },
  certificate_verified: { Icon: BadgeCheck, tone: 'good' },
  certificate_rejected: { Icon: FileWarning, tone: 'bad' },
  plan_activated: { Icon: Crown, tone: 'good' },
  plan_rejected: { Icon: ReceiptText, tone: 'bad' },
};
