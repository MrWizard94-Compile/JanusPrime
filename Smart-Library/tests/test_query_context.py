"""API tests for POST /query/context (retrieval-only, no LLM synthesis)."""

import pytest


def test_query_context_returns_slices(client, mock_services):
    """Context endpoint returns bounded slices without invoking the LLM."""
    _, mock_db, _, mock_llm = mock_services
    slices = ["[snippets]: def hello(): pass", "[Self-Healing Patch]: fixed NameError"]
    mock_db.query_context_slices.return_value = slices

    response = client.post(
        "/query/context",
        json={"query": "hello world example", "limit": 3, "max_chars": 8000},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["slices"] == slices
    assert body["total_chars"] == sum(len(slice_text) for slice_text in slices)
    mock_db.query_context_slices.assert_called_once_with(
        "hello world example",
        limit=3,
        max_chars=8000,
    )
    mock_llm.invoke.assert_not_called()


def test_query_context_uses_defaults(client, mock_services):
    """Omitted limit and max_chars fall back to endpoint defaults."""
    _, mock_db, _, _ = mock_services
    mock_db.query_context_slices.return_value = []

    response = client.post("/query/context", json={"query": "default params"})

    assert response.status_code == 200
    mock_db.query_context_slices.assert_called_once_with(
        "default params",
        limit=3,
        max_chars=8000,
    )


@pytest.mark.parametrize(
    "limit,expected_limit",
    [
        (0, 1),
        (-5, 1),
        (1, 1),
        (10, 10),
        (99, 10),
    ],
)
def test_query_context_clamps_limit(client, mock_services, limit, expected_limit):
    """Limit is clamped to the inclusive range [1, 10]."""
    _, mock_db, _, _ = mock_services
    mock_db.query_context_slices.return_value = []

    response = client.post(
        "/query/context",
        json={"query": "clamp limit", "limit": limit},
    )

    assert response.status_code == 200
    mock_db.query_context_slices.assert_called_once_with(
        "clamp limit",
        limit=expected_limit,
        max_chars=8000,
    )


@pytest.mark.parametrize(
    "max_chars,expected_max_chars",
    [
        (0, 256),
        (100, 256),
        (256, 256),
        (8000, 8000),
        (50000, 32000),
    ],
)
def test_query_context_clamps_max_chars(
    client, mock_services, max_chars, expected_max_chars
):
    """max_chars is clamped to the inclusive range [256, 32000]."""
    _, mock_db, _, _ = mock_services
    mock_db.query_context_slices.return_value = []

    response = client.post(
        "/query/context",
        json={"query": "clamp chars", "max_chars": max_chars},
    )

    assert response.status_code == 200
    mock_db.query_context_slices.assert_called_once_with(
        "clamp chars",
        limit=3,
        max_chars=expected_max_chars,
    )


def test_query_context_returns_503_when_startup_failed(client_startup_failed):
    """Context retrieval returns 503 when core services failed to initialize."""
    response = client_startup_failed.post(
        "/query/context",
        json={"query": "unavailable"},
    )

    assert response.status_code == 503
    assert "not installed" in response.json()["detail"]