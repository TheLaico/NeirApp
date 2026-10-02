import { BadgeCheck, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Crown, FileWarning, Flag, MessageSquareReply, ReceiptText, ShieldOff, Sofa, Star, Warehouse } from 'lucide-react';

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
  listing_activated: { Icon: Sofa, tone: 'good' },
  listing_payment_rejected: { Icon: ReceiptText, tone: 'bad' },
  listing_removed: { Icon: ShieldOff, tone: 'bad' },
  listing_reported: { Icon: Flag, tone: 'bad' },
  supplier_activated: { Icon: Warehouse, tone: 'good' },
  supplier_payment_rejected: { Icon: ReceiptText, tone: 'bad' },
  reservation_new: { Icon: CalendarPlus, tone: 'new' },
  reservation_confirmed: { Icon: CalendarCheck, tone: 'good' },
  reservation_declined: { Icon: CalendarX, tone: 'bad' },
  reservation_cancelled: { Icon: CalendarX, tone: 'bad' },
  hotel_review_new: { Icon: Star, tone: 'new' },
  hotel_review_reply: { Icon: MessageSquareReply, tone: 'info' },
};
