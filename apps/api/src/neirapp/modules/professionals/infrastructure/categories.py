from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.professionals.domain.categories import Category, Subcategory
from neirapp.modules.professionals.infrastructure.models import CategoryModel, SubcategoryModel


def _to_domain(model: CategoryModel) -> Category:
    return Category(
        id=model.id,
        label=model.label,
        icon=model.icon,
        color=model.color,
        position=model.position,
        subcategories=[
            Subcategory(id=s.id, label=s.label, color=s.color, position=s.position)
            for s in model.subcategories
        ],
    )


class SqlAlchemyCategoryRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def list_all(self) -> list[Category]:
        async with self._session_factory() as session:
            result = await session.execute(select(CategoryModel).order_by(CategoryModel.position))
            return [_to_domain(m) for m in result.scalars()]

    async def get(self, category_id: str) -> Category | None:
        async with self._session_factory() as session:
            model = await session.get(CategoryModel, category_id)
            return _to_domain(model) if model else None

    async def add(self, category: Category) -> None:
        async with self._session_factory() as session:
            session.add(
                CategoryModel(
                    id=category.id,
                    label=category.label,
                    icon=category.icon,
                    color=category.color,
                    position=category.position,
                )
            )
            await session.commit()

    async def delete(self, category_id: str) -> None:
        async with self._session_factory() as session:
            # Las subcategorías se borran a mano: SQLite no aplica ON DELETE CASCADE sin PRAGMA.
            await session.execute(
                delete(SubcategoryModel).where(SubcategoryModel.category_id == category_id)
            )
            await session.execute(delete(CategoryModel).where(CategoryModel.id == category_id))
            await session.commit()

    async def add_subcategory(self, category_id: str, sub: Subcategory) -> None:
        async with self._session_factory() as session:
            session.add(
                SubcategoryModel(
                    category_id=category_id,
                    id=sub.id,
                    label=sub.label,
                    color=sub.color,
                    position=sub.position,
                )
            )
            await session.commit()

    async def update_subcategory(self, category_id: str, sub: Subcategory) -> None:
        async with self._session_factory() as session:
            model = await session.get(SubcategoryModel, (category_id, sub.id))
            if model is not None:
                model.label = sub.label
                model.color = sub.color
                await session.commit()

    async def delete_subcategory(self, category_id: str, subcategory_id: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                delete(SubcategoryModel).where(
                    SubcategoryModel.category_id == category_id,
                    SubcategoryModel.id == subcategory_id,
                )
            )
            await session.commit()
