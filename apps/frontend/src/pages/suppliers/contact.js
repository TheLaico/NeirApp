import { Globe, Mail, MapPin, Phone } from 'lucide-react';
import { FacebookIcon, InstagramIcon, WhatsappIcon } from '../../components/icons/SocialIcons.jsx';
import { phoneLabel, telLink, whatsappLink } from '../../features/suppliers/model.js';

/** Las formas de contactar a una empresa, en orden: llamar, WhatsApp, correo, dirección, web y redes. */
export function contactRows(s) {
  return [
    { key: 'phone', Icon: Phone, label: 'Llamar', value: phoneLabel(s.phone), href: telLink(s.phone) },
    s.whatsapp && { key: 'wa', Icon: WhatsappIcon, label: 'WhatsApp', value: phoneLabel(s.whatsapp), href: whatsappLink(s.whatsapp, s.company_name), external: true },
    s.email && { key: 'mail', Icon: Mail, label: 'Correo', value: s.email, href: `mailto:${s.email}` },
    s.address && { key: 'addr', Icon: MapPin, label: 'Dirección', value: s.address, href: `https://www.google.com/maps/search/${encodeURIComponent(`${s.address}, Neira, Caldas`)}`, external: true },
    s.website && { key: 'web', Icon: Globe, label: 'Página web', value: s.website.replace(/^https?:\/\//, ''), href: s.website, external: true },
    s.facebook && { key: 'fb', Icon: FacebookIcon, label: 'Facebook', value: s.facebook.replace(/^https?:\/\/(www\.)?/, ''), href: s.facebook, external: true },
    s.instagram && { key: 'ig', Icon: InstagramIcon, label: 'Instagram', value: s.instagram.replace(/^https?:\/\/(www\.)?/, ''), href: s.instagram, external: true },
  ].filter(Boolean);
}
