from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.professionals.domain.appointments import AppointmentRequest
from neirapp.modules.professionals.domain.certificates import Certificate, CertificateStatus
from neirapp.modules.professionals.domain.plans import Subscription

# Colombia no tiene horario de verano: siempre UTC-5. Así no se depende de la base de zonas
# horarias del sistema, que en Windows no viene instalada.
COLOMBIA = timezone(timedelta(hours=-5))
_DAYS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
_MONTHS = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)  # fmt: skip


def when_label(moment: datetime) -> str:
    """ "viernes 2 de octubre a las 10:30 a. m." en hora de Colombia."""
    local = moment.astimezone(COLOMBIA)
    hour = local.hour % 12 or 12
    suffix = "a. m." if local.hour < 12 else "p. m."
    return (
        f"{_DAYS[local.weekday()]} {local.day} de {_MONTHS[local.month - 1]} "
        f"a las {hour}:{local.minute:02d} {suffix}"
    )


# A dónde lleva cada aviso en el frontend.
PROFESSIONAL_REQUESTS = "/profesional?seccion=requests"
PROFESSIONAL_CERTIFICATES = "/profesional?seccion=certificates"
CUSTOMER_REQUESTS = "/profesionales/mis-solicitudes"
PROFESSIONAL_PLANS = "/profesional/planes"


class NotificationKind(StrEnum):
    REQUEST_NEW = "request_new"  # Al profesional
    REQUEST_CANCELLED = "request_cancelled"  # Al otro lado de quien cancela
    REQUEST_SCHEDULED = "request_scheduled"  # Al cliente
    REQUEST_RESCHEDULED = "request_rescheduled"  # Al cliente
    REQUEST_REJECTED = "request_rejected"  # Al cliente
    CERTIFICATE_VERIFIED = "certificate_verified"  # Al profesional
    CERTIFICATE_REJECTED = "certificate_rejected"  # Al profesional
    PLAN_ACTIVATED = "plan_activated"  # Al profesional
    PLAN_REJECTED = "plan_rejected"  # Al profesional
    # De MarquetNeira (los crea ese módulo a través de `SendNotification`).
    LISTING_ACTIVATED = "listing_activated"  # Al vendedor
    LISTING_PAYMENT_REJECTED = "listing_payment_rejected"  # Al vendedor
    LISTING_REMOVED = "listing_removed"  # Al vendedor
    LISTING_REPORTED = "listing_reported"  # A los administradores
    # De Proveedores.
    SUPPLIER_ACTIVATED = "supplier_activated"  # A la empresa
    SUPPLIER_PAYMENT_REJECTED = "supplier_payment_rejected"  # A la empresa
    # De Hospedaje.
    RESERVATION_NEW = "reservation_new"  # Al hospedaje
    RESERVATION_CANCELLED = "reservation_cancelled"  # Al hospedaje
    RESERVATION_CONFIRMED = "reservation_confirmed"  # Al huésped
    RESERVATION_DECLINED = "reservation_declined"  # Al huésped
    HOTEL_REVIEW_NEW = "hotel_review_new"  # Al hospedaje
    HOTEL_REVIEW_REPLY = "hotel_review_reply"  # A quien escribió la reseña
    HOTEL_PLAN_ACTIVATED = "hotel_plan_activated"  # Al hotel: ya aparece
    HOTEL_FEATURED = "hotel_featured"  # Al hotel: está destacado
    HOTEL_PAYMENT_REJECTED = "hotel_payment_rejected"  # Al hotel


@dataclass
class Notification:
    """Un aviso para una persona: algo pasó con sus citas o sus certificados."""

    id: UUID
    user_id: UUID
    kind: NotificationKind
    title: str
    body: str
    link: str
    is_read: bool
    created_at: datetime

    @classmethod
    def new(
        cls, user_id: UUID, kind: NotificationKind, title: str, body: str, link: str, now: datetime
    ) -> "Notification":
        return cls(uuid4(), user_id, kind, title[:120], body[:300], link, False, now)


def _first_name(name: str) -> str:
    return name.split(" ")[0] if name else "Alguien"


def _quoted(text: str) -> str:
    return f"“{text}”" if text else ""


def request_received(request: AppointmentRequest, now: datetime) -> Notification:
    what = request.service_name or "una cita"
    return Notification.new(
        request.professional_id,
        NotificationKind.REQUEST_NEW,
        "Nueva solicitud de cita",
        f"{request.customer_name} te pidió {what}. Respóndele pronto.",
        PROFESSIONAL_REQUESTS,
        now,
    )


def request_scheduled(
    request: AppointmentRequest, professional_name: str, *, rescheduled: bool, now: datetime
) -> Notification:
    kind = (
        NotificationKind.REQUEST_RESCHEDULED if rescheduled else NotificationKind.REQUEST_SCHEDULED
    )
    title = "Tu cita cambió de fecha" if rescheduled else "¡Tu cita quedó agendada!"
    note = f" Indicaciones: {request.note}" if request.note else ""
    when = when_label(request.scheduled_at) if request.scheduled_at else "día acordado"
    return Notification.new(
        request.customer_id,
        kind,
        title,
        # `when` ya termina en "a. m."/"p. m.": no se le agrega otro punto.
        f"{professional_name} te espera el {when}{note}",
        CUSTOMER_REQUESTS,
        now,
    )


def request_rejected(
    request: AppointmentRequest, professional_name: str, now: datetime
) -> Notification:
    reason = f" Motivo: {request.note}" if request.note else ""
    return Notification.new(
        request.customer_id,
        NotificationKind.REQUEST_REJECTED,
        "Tu solicitud no fue aceptada",
        f"{professional_name} no puede atenderte esta vez.{reason} Puedes buscar otro profesional.",
        CUSTOMER_REQUESTS,
        now,
    )


def request_cancelled(
    request: AppointmentRequest, professional_name: str, now: datetime
) -> Notification:
    reason = f" Motivo: {request.note}" if request.note else ""
    if request.cancelled_by_customer:
        return Notification.new(
            request.professional_id,
            NotificationKind.REQUEST_CANCELLED,
            "Cancelaron una cita",
            f"{_first_name(request.customer_name)} canceló su solicitud.{reason}",
            PROFESSIONAL_REQUESTS,
            now,
        )
    return Notification.new(
        request.customer_id,
        NotificationKind.REQUEST_CANCELLED,
        "Tu cita fue cancelada",
        f"{professional_name} canceló la cita.{reason}",
        CUSTOMER_REQUESTS,
        now,
    )


def certificate_reviewed(certificate: Certificate, now: datetime) -> Notification:
    if certificate.status is CertificateStatus.VERIFIED:
        shown = (
            " Tu perfil ya muestra el sello de verificado."
            if certificate.show_on_profile
            else " Actívalo en tu perfil para que los clientes lo vean."
        )
        return Notification.new(
            certificate.user_id,
            NotificationKind.CERTIFICATE_VERIFIED,
            "Certificado verificado",
            f"{_quoted(certificate.title)} fue aprobado.{shown}",
            PROFESSIONAL_CERTIFICATES,
            now,
        )
    return Notification.new(
        certificate.user_id,
        NotificationKind.CERTIFICATE_REJECTED,
        "Un certificado necesita corrección",
        f"{_quoted(certificate.title)} no fue aprobado. Motivo: {certificate.review_note}",
        PROFESSIONAL_CERTIFICATES,
        now,
    )


def _day_label(moment: datetime) -> str:
    local = moment.astimezone(COLOMBIA)
    return f"{local.day} de {_MONTHS[local.month - 1]}"


def plan_activated(subscription: Subscription, plan_name: str, now: datetime) -> Notification:
    expires = subscription.expires_at or now
    starts = subscription.starts_at or now
    when = (
        f"Está activo hasta el {_day_label(expires)}."
        if starts <= now
        else f"Empieza el {_day_label(starts)}, cuando termine tu periodo actual."
    )
    return Notification.new(
        subscription.user_id,
        NotificationKind.PLAN_ACTIVATED,
        f"Tu plan {plan_name} está listo",
        f"Confirmamos tu pago. {when}",
        PROFESSIONAL_PLANS,
        now,
    )


def plan_rejected(subscription: Subscription, plan_name: str, now: datetime) -> Notification:
    return Notification.new(
        subscription.user_id,
        NotificationKind.PLAN_REJECTED,
        f"No pudimos activar tu plan {plan_name}",
        f"Motivo: {subscription.note.rstrip('.')}. Revisa el pago y vuelve a intentarlo.",
        PROFESSIONAL_PLANS,
        now,
    )
