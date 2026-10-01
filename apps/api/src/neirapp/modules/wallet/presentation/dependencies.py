from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.wallet.application.app import WalletApp


def get_wallet(request: Request) -> WalletApp:
    wallet: WalletApp = request.app.state.wallet
    return wallet


WalletDep = Annotated[WalletApp, Depends(get_wallet)]
