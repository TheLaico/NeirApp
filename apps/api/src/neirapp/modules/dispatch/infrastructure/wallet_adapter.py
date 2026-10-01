from uuid import UUID

from neirapp.modules.wallet.application.app import WalletApp


class WalletAdapter:
    """Implementa `WalletPort` sobre la fachada pública de `wallet` (`WalletApp`)."""

    def __init__(self, wallet: WalletApp) -> None:
        self._wallet = wallet

    async def credit_courier(self, courier_id: UUID, amount_cop: int, delivery_id: UUID) -> None:
        await self._wallet.credit_courier(
            courier_id, amount_cop, reason="delivery_completed", reference_id=delivery_id
        )
