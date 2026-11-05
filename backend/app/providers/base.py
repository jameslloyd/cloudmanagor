"""Modular provider plugin architecture and registry for CloudManager."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any

from app.schemas import CredentialFieldSchema, ProviderMetadata


class BaseCloudProvider(ABC):
    """Abstract base class for all cloud / SaaS product connectors.

    New products can be added by subclassing `BaseCloudProvider` and registering
    with `ProviderRegistry.register(...)`.
    """

    provider_id: str
    display_name: str
    description: str
    category: str
    supported_domains: list[str]
    credential_fields: list[CredentialFieldSchema]

    def get_metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            provider_id=self.provider_id,
            display_name=self.display_name,
            description=self.description,
            category=self.category,
            supported_domains=self.supported_domains,
            credential_fields=self.credential_fields,
        )

    @abstractmethod
    def collect_data(
        self,
        connection_id: str,
        mode: str = "mock",
        credentials: dict[str, Any] | None = None,
        days: int = 30,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str]:
        """Collect normalized metrics and actionable insights for this provider.

        Returns:
            (metrics_list, insights_list, status_message)
        """
        raise NotImplementedError

    @staticmethod
    def date_series(days: int = 30) -> list[str]:
        today = datetime.now(timezone.utc).date()
        return [
            (today - timedelta(days=(days - 1 - i))).isoformat()
            for i in range(days)
        ]


class ProviderRegistry:
    """Central registry of modular product connectors."""

    _providers: dict[str, BaseCloudProvider] = {}

    @classmethod
    def register(cls, provider: BaseCloudProvider) -> BaseCloudProvider:
        cls._providers[provider.provider_id] = provider
        return provider

    @classmethod
    def get(cls, provider_id: str) -> BaseCloudProvider | None:
        return cls._providers.get(provider_id)

    @classmethod
    def list_all(cls) -> list[BaseCloudProvider]:
        return list(cls._providers.values())

    @classmethod
    def list_metadata(cls) -> list[ProviderMetadata]:
        return [p.get_metadata() for p in cls._providers.values()]
