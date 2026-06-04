#!/usr/bin/env python3
"""Запуск FastAPI-приложения через uvicorn с портом из $PORT (Railway).

Railway задаёт переменную окружения PORT — читаем её, иначе 8000.
"""

import os
import uvicorn

from app.main import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
