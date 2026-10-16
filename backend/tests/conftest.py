import pytest
@pytest.fixture(autouse=True)
def isolated_usage(monkeypatch):
    from app.governance import quota
    monkeypatch.setattr(quota,'memory',quota.MemoryStore())
