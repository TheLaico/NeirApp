from dataclasses import dataclass

from neirapp.modules.wallet.application.wallet import (
    CreditCourier,
    GetBalance,
    ListLedger,
    RequestWithdrawal,
)


@dataclass(frozen=True)
class WalletApp:
    credit_courier: CreditCourier
    get_balance: GetBalance
    list_ledger: ListLedger
    request_withdrawal: RequestWithdrawal
