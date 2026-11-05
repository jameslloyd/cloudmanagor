"""Providers package - registers modular connectors on import."""

from app.providers.base import BaseCloudProvider, ProviderRegistry
from app.providers import aws, cloudflare, github  # noqa: F401

__all__ = ["BaseCloudProvider", "ProviderRegistry"]
