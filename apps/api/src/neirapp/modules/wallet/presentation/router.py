from fastapi import APIRouter

from neirapp.modules.identity.presentation.dependencies import CurrentUser
from neirapp.modules.wallet.presentation.dependencies import WalletDep
from neirapp.modules.wallet.presentation.schemas import (
    BalanceResponse,
    LedgerEntryResponse,
    RequestWithdrawalRequest,
)

router = APIRouter(prefix="/wallet", tags=["wallet"])

# El saldo se calcula siempre del ledger del usuario autenticado (nunca de un id que mande el
# cliente): un usuario que nunca repartió simplemente tiene saldo 0 y no puede retirar nada — no
# hace falta verificar aparte que sea repartidor para que esto sea seguro.


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(user: CurrentUser, wallet: WalletDep) -> BalanceResponse:
    balance = await wallet.get_balance(user.id)
    return BalanceResponse(balance_cop=balance)


@router.get("/ledger", response_model=list[LedgerEntryResponse])
async def list_ledger(user: CurrentUser, wallet: WalletDep) -> list[LedgerEntryResponse]:
    entries = await wallet.list_ledger(user.id)
    return [LedgerEntryResponse.from_domain(e) for e in entries]


@router.post("/withdrawals", response_model=LedgerEntryResponse, status_code=201)
async def request_withdrawal(
    body: RequestWithdrawalRequest, user: CurrentUser, wallet: WalletDep
) -> LedgerEntryResponse:
    entry = await wallet.request_withdrawal(user.id, body.amount_cop)
    return LedgerEntryResponse.from_domain(entry)
