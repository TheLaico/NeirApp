from neirapp.modules.professionals.application.ports import CategoryRepository, ProfileRepository
from neirapp.modules.professionals.domain.categories import (
    Category,
    Subcategory,
    clean_color,
    clean_icon,
    clean_label,
    unique_slug,
)
from neirapp.modules.professionals.domain.errors import (
    CategoryInUse,
    CategoryNotFound,
    SubcategoryNotFound,
)


async def _get(repo: CategoryRepository, category_id: str) -> Category:
    category = await repo.get(category_id)
    if category is None:
        raise CategoryNotFound()
    return category


class ListCategories:
    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    async def __call__(self) -> list[Category]:
        return await self._repo.list_all()


class CreateCategory:
    """Nueva área del directorio. El id sale del nombre ("Enfermería" -> "enfermeria")."""

    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    async def __call__(self, label: str, icon: str, color: str) -> Category:
        existing = await self._repo.list_all()
        clean = clean_label(label)
        category = Category(
            id=unique_slug(clean, {c.id for c in existing}, "categoria"),
            label=clean,
            icon=clean_icon(icon),
            color=clean_color(color),
            position=max((c.position for c in existing), default=-1) + 1,
        )
        await self._repo.add(category)
        return category


class DeleteCategory:
    """Borra el área y sus especialidades, siempre que ningún perfil la esté usando."""

    def __init__(self, repo: CategoryRepository, profiles: ProfileRepository) -> None:
        self._repo = repo
        self._profiles = profiles

    async def __call__(self, category_id: str) -> None:
        await _get(self._repo, category_id)
        if any(p.category_id == category_id for p in await self._profiles.list_all()):
            raise CategoryInUse()
        await self._repo.delete(category_id)


class AddSubcategory:
    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    async def __call__(self, category_id: str, label: str, color: str) -> Subcategory:
        category = await _get(self._repo, category_id)
        clean = clean_label(label)
        sub = Subcategory(
            id=unique_slug(clean, {s.id for s in category.subcategories}, "especialidad"),
            label=clean,
            color=clean_color(color),
            position=max((s.position for s in category.subcategories), default=-1) + 1,
        )
        await self._repo.add_subcategory(category_id, sub)
        return sub


class SetSubcategoryColor:
    def __init__(self, repo: CategoryRepository) -> None:
        self._repo = repo

    async def __call__(self, category_id: str, subcategory_id: str, color: str) -> Subcategory:
        sub = (await _get(self._repo, category_id)).find(subcategory_id)
        if sub is None:
            raise SubcategoryNotFound()
        sub.color = clean_color(color)
        await self._repo.update_subcategory(category_id, sub)
        return sub


class DeleteSubcategory:
    def __init__(self, repo: CategoryRepository, profiles: ProfileRepository) -> None:
        self._repo = repo
        self._profiles = profiles

    async def __call__(self, category_id: str, subcategory_id: str) -> None:
        if (await _get(self._repo, category_id)).find(subcategory_id) is None:
            raise SubcategoryNotFound()
        if any(
            p.category_id == category_id and p.subcategory_id == subcategory_id
            for p in await self._profiles.list_all()
        ):
            raise CategoryInUse(
                "Hay profesionales con perfil en esta especialidad. "
                "Pídeles que la cambien antes de borrarla."
            )
        await self._repo.delete_subcategory(category_id, subcategory_id)
