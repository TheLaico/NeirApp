from neirapp.shared.domain.errors import ConflictError, NotFoundError, ValidationError


class InvalidCompanyName(ValidationError):
    code = "invalid_company_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre de la empresa (entre 2 y 80 caracteres)."


class InvalidSupplierDescription(ValidationError):
    code = "invalid_supplier_description"

    @classmethod
    def default_message(cls) -> str:
        return "Cuenta qué productos ofreces (entre 20 y 400 caracteres)."


class InvalidSupplierText(ValidationError):
    code = "invalid_supplier_text"

    @classmethod
    def default_message(cls) -> str:
        return "Uno de los textos es demasiado largo."


class InvalidSupplierPhone(ValidationError):
    code = "invalid_supplier_phone"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un teléfono de 7 a 10 dígitos."


class InvalidSupplierWhatsapp(ValidationError):
    code = "invalid_supplier_whatsapp"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un WhatsApp de 10 dígitos, por ejemplo 310 123 4567."


class InvalidSupplierEmail(ValidationError):
    code = "invalid_supplier_email"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa el correo de contacto."


class InvalidSupplierLink(ValidationError):
    code = "invalid_supplier_link"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa los enlaces: deben ser de Facebook, Instagram o una página web (https://…)."


class InvalidSupplierImage(ValidationError):
    code = "invalid_supplier_image"

    @classmethod
    def default_message(cls) -> str:
        return "Sube las imágenes desde la app (logo, portada y catálogo)."


class SupplierNotFound(NotFoundError):
    code = "supplier_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Proveedor no encontrado."


class InvalidPaymentReference(ValidationError):
    code = "invalid_supplier_payment_reference"

    @classmethod
    def default_message(cls) -> str:
        return "El comprobante puede tener hasta 120 caracteres."


class InvalidPaymentTransition(ConflictError):
    code = "invalid_supplier_payment_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Este pago ya fue revisado."


class PaymentPending(ConflictError):
    code = "supplier_payment_pending"

    @classmethod
    def default_message(cls) -> str:
        return "Ya enviaste un pago; estamos confirmándolo."


class PaymentNotFound(NotFoundError):
    code = "supplier_payment_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Pago no encontrado."


class MissingNote(ValidationError):
    code = "missing_note"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el motivo."


class ProfileRequired(ValidationError):
    code = "supplier_profile_required"

    @classmethod
    def default_message(cls) -> str:
        return "Primero crea el perfil de tu empresa en Mi empresa."
