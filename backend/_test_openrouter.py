"""Test OpenRouter directly with the key + model from .env — no DB needed.

Run on the machine with internet:  python _test_openrouter.py
Confirms whether requests reach OpenRouter and succeed (401 = bad key,
400 = bad/unavailable model). Delete this file afterwards.
"""
import json
import urllib.error
import urllib.request

from app.config import settings


def mask(k: str) -> str:
    return ("*" * max(0, len(k) - 4) + k[-4:]) if k else "<пусто>"


def main() -> None:
    key = (settings.openrouter_api_key or "").strip()
    model = settings.openrouter_model
    base = settings.openrouter_base_url.rstrip("/")
    print(f"key   = {mask(key)}")
    print(f"model = {model}")
    print(f"url   = {base}/chat/completions")
    if not key:
        print("ERROR: OPENROUTER_API_KEY пуст в .env")
        return

    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "Reply with one word: PONG"}],
        "temperature": 0,
    }).encode()
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.load(r)
        print("\nOK — OpenRouter ОТВЕТИЛ:")
        print("  reply:", data["choices"][0]["message"]["content"][:120])
        print("  model used:", data.get("model"))
    except urllib.error.HTTPError as e:
        print(f"\nHTTP {e.code} — OpenRouter отклонил запрос:")
        print(" ", e.read().decode()[:400])
        if e.code == 401:
            print("  -> ключ невалиден.")
        elif e.code in (400, 404):
            print("  -> модель недоступна на аккаунте; нужно сменить openrouter_model.")
    except Exception as e:  # noqa: BLE001
        print(f"\nERR {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
