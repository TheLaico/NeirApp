from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from neirapp.modules.professionals.application.ports import (
    AccessPort,
    Account,
    NotificationRepository,
    ProfileRepository,
    SubscriptionRepository,
)
from neirapp.modules.professionals.domain.entities import ProfessionalProfile
from neirapp.modules.professionals.domain.errors import (
    PlanRequestPending,
    SubscriptionNotFound,
)
from neirapp.modules.professionals.domain.notifications import plan_activated, plan_rejected
from neirapp.modules.professionals.domain.plans import (
    PLANS,
    PlanId,
    PlanSpec,
    Subscription,
    SubscriptionStatus,
    current_of,
    ensure_available,
    paid_until,
)
from neirapp.shared.application.ports import Clock


class PlanBook:
    """Qué plan tiene hoy cada profesional. Sin plan vigente (o sin acceso de profesional) su
    perfil no se publica; lo usan el directorio, "Ver perfil", la galería y las solicitudes."""

    def __init__(self, repo: SubscriptionRepository, access: AccessPort, clock: Clock) -> None:
        self._repo = repo
        self._access = access
        self._clock = clock

    async def of(self, user_id: UUID) -> PlanSpec | None:
        """El plan vigente, tenga o no acceso (para su propio panel)."""
        current = current_of(await self._repo.list_for(user_id), self._clock.now())
        return PLANS[current.plan] if current else None

    async def public(self, user_id: UUID) -> PlanSpec | None:
        """El plan con el que se publica: None si no tiene plan vigente o ya no tiene acceso."""
        if user_id not in await self._access.professional_ids():
            return None
        return await self.of(user_id)

    async def all_public(self) -> dict[UUID, PlanSpec]:
        now = self._clock.now()
        allowed = await self._access.professional_ids()
        by_user: dict[UUID, list[Subscription]] = {}
        for s in await self._repo.list_active():
            if s.user_id in allowed:
                by_user.setdefault(s.user_id, []).append(s)
        plans: dict[UUID, PlanSpec] = {}
        for user_id, subscriptions in by_user.items():
            current = current_of(subscriptions, now)
            if current:
                plans[user_id] = PLANS[current.plan]
        return plans


@dataclass(frozen=True)
class PlanStatus:
    """Lo que ve el profesional en "Planes": su plan vigente, renovaciones ya pagadas, la
    solicitud que espera confirmación y la última rechazada (para contarle el motivo)."""

    current: Subscription | None
    upcoming: list[Subscription]
    pending: Subscription | None
    last_rejected: Subscription | None


def _status(subscriptions: list[Subscription], now: datetime) -> PlanStatus:
    pending = next((s for s in subscriptions if s.status is SubscriptionStatus.PENDING), None)
    rejected = next((s for s in subscriptions if s.status is SubscriptionStatus.REJECTED), None)
    # Solo interesa el rechazo si es lo último que pasó (si después pidió otro, ya no aplica).
    if rejected and (pending or subscriptions[0] is not rejected):
        rejected = None
    upcoming = sorted(
        (s for s in subscriptions if s.is_upcoming(now)), key=lambda s: s.starts_at or now
    )
    return PlanStatus(current_of(subscriptions, now), upcoming, pending, rejected)


async def _activate(
    repo: SubscriptionRepository, subscription: Subscription, now: datetime
) -> list[Subscription]:
    """Si ya tiene pagado ese mismo plan, el mes nuevo empieza cuando termine; si cambia de plan,
    el nuevo empieza ya y lo anterior se cierra hoy. Devuelve lo que hay que guardar."""
    others = [s for s in await repo.list_for(subscription.user_id) if s.id != subscription.id]
    until = paid_until(others, subscription.plan, now)
    changed = [subscription]
    if until is None:
        for s in others:
            if s.is_current(now) or s.is_upcoming(now):
                s.end(now)
                changed.append(s)
    subscription.activate(until or now, now)
    return changed


class GetMyPlan:
    def __init__(self, repo: SubscriptionRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID) -> PlanStatus:
        return _status(await self._repo.list_for(user_id), self._clock.now())


class RequestPlan:
    """El profesional elige un plan y cuenta cómo pagó; queda esperando que el administrador
    confirme el pago."""

    def __init__(self, repo: SubscriptionRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, plan: PlanId, payment_reference: str) -> PlanStatus:
        ensure_available(plan)
        mine = await self._repo.list_for(user_id)
        if any(s.status is SubscriptionStatus.PENDING for s in mine):
            raise PlanRequestPending()
        now = self._clock.now()
        await self._repo.save_all([Subscription.request(user_id, plan, payment_reference, now)])
        return _status(await self._repo.list_for(user_id), now)


class CancelPlanRequest:
    def __init__(self, repo: SubscriptionRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, subscription_id: UUID) -> PlanStatus:
        subscription = await self._repo.get(subscription_id)
        if subscription is None or subscription.user_id != user_id:
            raise SubscriptionNotFound()
        subscription.cancel()
        await self._repo.save_all([subscription])
        return _status(await self._repo.list_for(user_id), self._clock.now())


@dataclass(frozen=True)
class ProfessionalPlanRow:
    """Para el administrador: un profesional, su plan y su solicitud pendiente. `profile` es None
    si todavía no armó su perfil (puede pedir un plan antes de hacerlo)."""

    user_id: UUID
    profile: ProfessionalProfile | None
    account: Account | None
    status: PlanStatus

    @property
    def name(self) -> str:
        if self.profile:
            return self.profile.display_name
        return self.account.name if self.account else ""


class ListProfessionalPlans:
    """Los profesionales con perfil o con alguna solicitud de plan, con su plan; primero los que
    tienen un pago por confirmar."""

    def __init__(
        self,
        repo: SubscriptionRepository,
        profiles: ProfileRepository,
        access: AccessPort,
        clock: Clock,
    ) -> None:
        self._repo = repo
        self._profiles = profiles
        self._access = access
        self._clock = clock

    async def __call__(self) -> list[ProfessionalPlanRow]:
        now = self._clock.now()
        profiles = {p.user_id: p for p in await self._profiles.list_all()}
        with_plans = {s.user_id for s in await self._repo.list_pending()} | {
            s.user_id for s in await self._repo.list_active()
        }
        rows = [
            ProfessionalPlanRow(
                user_id,
                profiles.get(user_id),
                await self._access.account(user_id),
                _status(await self._repo.list_for(user_id), now),
            )
            for user_id in profiles.keys() | with_plans
        ]
        return sorted(
            rows,
            key=lambda r: (
                r.status.pending is None,
                r.status.pending.requested_at if r.status.pending else now,
                r.name.lower(),
            ),
        )


class ApprovePlanRequest:
    """El administrador vio el pago: activa el plan por 30 días y le avisa al profesional."""

    def __init__(
        self, repo: SubscriptionRepository, notifications: NotificationRepository, clock: Clock
    ) -> None:
        self._repo = repo
        self._notifications = notifications
        self._clock = clock

    async def __call__(self, subscription_id: UUID) -> Subscription:
        subscription = await self._repo.get(subscription_id)
        if subscription is None:
            raise SubscriptionNotFound()
        now = self._clock.now()
        await self._repo.save_all(await _activate(self._repo, subscription, now))
        name = PLANS[subscription.plan].name
        await self._notifications.add(plan_activated(subscription, name, now))
        return subscription


class RejectPlanRequest:
    def __init__(
        self, repo: SubscriptionRepository, notifications: NotificationRepository, clock: Clock
    ) -> None:
        self._repo = repo
        self._notifications = notifications
        self._clock = clock

    async def __call__(self, subscription_id: UUID, note: str) -> Subscription:
        subscription = await self._repo.get(subscription_id)
        if subscription is None:
            raise SubscriptionNotFound()
        now = self._clock.now()
        subscription.reject(note, now)
        await self._repo.save_all([subscription])
        name = PLANS[subscription.plan].name
        await self._notifications.add(plan_rejected(subscription, name, now))
        return subscription


class GrantPlan:
    """El administrador activa un plan directamente (cortesía o pago recibido por otro medio)."""

    def __init__(
        self, repo: SubscriptionRepository, notifications: NotificationRepository, clock: Clock
    ) -> None:
        self._repo = repo
        self._notifications = notifications
        self._clock = clock

    async def __call__(self, user_id: UUID, plan: PlanId) -> PlanStatus:
        ensure_available(plan)
        now = self._clock.now()
        subscription = Subscription.request(user_id, plan, "Activado por el administrador", now)
        await self._repo.save_all(await _activate(self._repo, subscription, now))
        await self._notifications.add(plan_activated(subscription, PLANS[plan].name, now))
        return _status(await self._repo.list_for(user_id), now)


class EndPlan:
    """El administrador quita el plan vigente (y las renovaciones ya pagadas) desde hoy."""

    def __init__(self, repo: SubscriptionRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID) -> PlanStatus:
        now = self._clock.now()
        mine = await self._repo.list_for(user_id)
        ended = [s for s in mine if s.is_current(now) or s.is_upcoming(now)]
        for s in ended:
            s.end(now)
        await self._repo.save_all(ended)
        return _status(await self._repo.list_for(user_id), now)
