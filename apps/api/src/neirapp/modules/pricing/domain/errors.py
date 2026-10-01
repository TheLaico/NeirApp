from neirapp.shared.domain.errors import ValidationError


class InvalidDeliveryFee(ValidationError):
    code = "invalid_delivery_fee"

    @classmethod
    def default_message(cls) -> str:
        return "El valor del envío debe estar entre $0 y $100.000."


class InvalidCourierShare(ValidationError):
    code = "invalid_courier_share"

    @classmethod
    def default_message(cls) -> str:
        return "El porcentaje del repartidor debe estar entre 0 y 100."
