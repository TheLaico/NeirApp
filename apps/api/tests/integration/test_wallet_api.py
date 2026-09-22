from typing import Any

import httpx

API = "/api/v1"


async def _register(client: httpx.AsyncClient, email: str = "ana@correo.com") -> dict[str, Any]:
    response = await client.post(
        f"{API}/identity/register",
        json={
            "email": email,
            "password": "clave-segura-123",
            "full_name": "Ana Gómez",
            "phone": "300 123 4567",
            "accepted_terms": True,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["tokens"]  # type: ignore[no-any-return]


def _bearer(tokens: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


class TestWallet:
    async def test_saldo_por_defecto_es_cero(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.get(f"{API}/wallet/balance", headers=_bearer(tokens))
        assert response.status_code == 200
        assert response.json()["balance_cop"] == 0

    async def test_ledger_vacio_por_defecto(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.get(f"{API}/wallet/ledger", headers=_bearer(tokens))
        assert response.status_code == 200
        assert response.json() == []

    async def test_retiro_sin_saldo_falla(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.post(
            f"{API}/wallet/withdrawals", json={"amount_cop": 1_000}, headers=_bearer(tokens)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "insufficient_balance"

    async def test_requiere_autenticacion(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{API}/wallet/balance")
        assert response.status_code == 401

    async def test_monto_de_retiro_invalido_lo_rechaza_el_request(
        self, client: httpx.AsyncClient
    ) -> None:
        tokens = await _register(client)
        response = await client.post(
            f"{API}/wallet/withdrawals", json={"amount_cop": 0}, headers=_bearer(tokens)
        )
        assert response.status_code == 422
