from neirapp.shared.domain.errors import ValidationError


class InvalidAmount(ValidationError):
    code = "invalid_amount"

    @classmethod
    def default_message(cls) -> str:
        return "El monto debe ser mayor que cero."


class InsufficientBalance(ValidationError):
    code = "insufficient_balance"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes saldo suficiente para retirar ese monto."
