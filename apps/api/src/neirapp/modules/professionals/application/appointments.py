from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from neirapp.modules.professionals.application.ports import (
    AccessPort,
    AppointmentRepository,
    NotificationRepository,
    ProfileRepository,
    ServiceRepository,
)
from neirapp.modules.professionals.domain.appointments import (
    MAX_PENDING_PER_PROFESSIONAL,
    AppointmentRequest,
    Modality,
    RequestData,
    RequestStatus,
)
from neirapp.modules.professionals.domain.errors import (
    AppointmentRequestNotFound,
    CannotRequestYourself,
    InvalidAppointmentRequest,
    ProfileNotFound,
    RequestsPaused,
    TooManyPendingRequests,
)
from neirapp.modules.professionals.domain.notifications import (
    request_cancelled,
    request_received,
    request_rejected,
    request_scheduled,
)
from neirapp.shared.application.ports import Clock


async def _professional_name(profiles: ProfileRepository, professional_id: UUID) -> str:
    profile = await profiles.get(professional_id)
    return profile.display_name if profile else "El profesional"


class SendRequest:
    """Una persona le pide una cita a un profesional autorizado y con perfil publicado."""

    def __init__(
        self,
        repo: AppointmentRepository,
        profiles: ProfileRepository,
        services: ServiceRepository,
        access: AccessPort,
        notifications: NotificationRepository,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._profiles = profiles
        self._services = services
        self._access = access
        self._notifications = notifications
        self._clock = clock

    async def __call__(
        self, professional_id: UUID, customer_id: UUID, customer_name: str, data: RequestData
    ) -> AppointmentRequest:
        if professional_id == customer_id:
            raise CannotRequestYourself()
        profile = await self._profiles.get(professional_id)
        if (
            profile is None
            or not profile.is_listed
            or professional_id not in await self._access.professional_ids()
        ):
            raise ProfileNotFound("Perfil no encontrado.")
        if not profile.accepts_requests:
            raise RequestsPaused()
        service_name = ""
        if data.service_id is not None:
            service = await self._services.get(data.service_id)
            if service is None or service.user_id != professional_id or not service.is_active:
                raise InvalidAppointmentRequest("Ese servicio ya no está disponible.")
            service_name = service.name
        pending = [
            r
            for r in await self._repo.list_for_customer(customer_id)
            if r.professional_id == professional_id and r.status is RequestStatus.PENDING
        ]
        if len(pending) >= MAX_PENDING_PER_PROFESSIONAL:
            raise TooManyPendingRequests()
        offered = {
            m
            for m, on in (
                (Modality.OFFICE, profile.modalities.office),
                (Modality.HOME, profile.modalities.home),
                (Modality.ONLINE, profile.modalities.online),
            )
            if on
        }
        request = AppointmentRequest.create(
            professional_id=professional_id,
            customer_id=customer_id,
            customer_name=customer_name,
            data=data,
            offered=offered,
            service_name=service_name,
            now=self._clock.now(),
        )
        await self._repo.save(request)
        await self._notifications.add(request_received(request, request.created_at))
        return request


async def _received(
    repo: AppointmentRepository, professional_id: UUID, request_id: UUID
) -> AppointmentRequest:
    request = await repo.get(request_id)
    if request is None or request.professional_id != professional_id:
        raise AppointmentRequestNotFound()
    return request


class ListReceivedRequests:
    def __init__(self, repo: AppointmentRepository) -> None:
        self._repo = repo

    async def __call__(self, professional_id: UUID) -> list[AppointmentRequest]:
        return await self._repo.list_for_professional(professional_id)


class ScheduleRequest:
    def __init__(
        self,
        repo: AppointmentRepository,
        profiles: ProfileRepository,
        notifications: NotificationRepository,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._profiles = profiles
        self._notifications = notifications
        self._clock = clock

    async def __call__(
        self, professional_id: UUID, request_id: UUID, when: datetime, note: str
    ) -> AppointmentRequest:
        request = await _received(self._repo, professional_id, request_id)
        rescheduled = request.status is RequestStatus.SCHEDULED
        request.schedule(when, note, self._clock.now())
        await self._repo.save(request)
        name = await _professional_name(self._profiles, professional_id)
        await self._notifications.add(
            request_scheduled(request, name, rescheduled=rescheduled, now=request.updated_at)
        )
        return request


class RejectRequest:
    def __init__(
        self,
        repo: AppointmentRepository,
        profiles: ProfileRepository,
        notifications: NotificationRepository,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._profiles = profiles
        self._notifications = notifications
        self._clock = clock

    async def __call__(
        self, professional_id: UUID, request_id: UUID, note: str
    ) -> AppointmentRequest:
        request = await _received(self._repo, professional_id, request_id)
        request.reject(note, self._clock.now())
        await self._repo.save(request)
        name = await _professional_name(self._profiles, professional_id)
        await self._notifications.add(request_rejected(request, name, request.updated_at))
        return request


class CompleteRequest:
    def __init__(self, repo: AppointmentRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, professional_id: UUID, request_id: UUID) -> AppointmentRequest:
        request = await _received(self._repo, professional_id, request_id)
        request.complete(self._clock.now())
        await self._repo.save(request)
        return request


class CancelByProfessional:
    def __init__(
        self,
        repo: AppointmentRepository,
        profiles: ProfileRepository,
        notifications: NotificationRepository,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._profiles = profiles
        self._notifications = notifications
        self._clock = clock

    async def __call__(
        self, professional_id: UUID, request_id: UUID, note: str
    ) -> AppointmentRequest:
        request = await _received(self._repo, professional_id, request_id)
        request.cancel(by_customer=False, note=note, now=self._clock.now())
        await self._repo.save(request)
        name = await _professional_name(self._profiles, professional_id)
        await self._notifications.add(request_cancelled(request, name, request.updated_at))
        return request


@dataclass(frozen=True)
class SentRequest:
    request: AppointmentRequest
    professional_name: str


class ListSentRequests:
    """Las solicitudes que envió una persona, con el nombre del profesional."""

    def __init__(self, repo: AppointmentRepository, profiles: ProfileRepository) -> None:
        self._repo = repo
        self._profiles = profiles

    async def __call__(self, customer_id: UUID) -> list[SentRequest]:
        requests = await self._repo.list_for_customer(customer_id)
        names = {p.user_id: p.display_name for p in await self._profiles.list_all()}
        return [SentRequest(r, names.get(r.professional_id, "Profesional")) for r in requests]


class CancelByCustomer:
    def __init__(
        self, repo: AppointmentRepository, notifications: NotificationRepository, clock: Clock
    ) -> None:
        self._repo = repo
        self._notifications = notifications
        self._clock = clock

    async def __call__(self, customer_id: UUID, request_id: UUID, note: str) -> AppointmentRequest:
        request = await self._repo.get(request_id)
        if request is None or request.customer_id != customer_id:
            raise AppointmentRequestNotFound()
        request.cancel(by_customer=True, note=note, now=self._clock.now())
        await self._repo.save(request)
        await self._notifications.add(request_cancelled(request, "", request.updated_at))
        return request
