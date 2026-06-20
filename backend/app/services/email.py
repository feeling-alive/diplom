"""Email delivery for the password-reset flow (fastapi-mail / SMTP).

Graceful degradation: when ``smtp_host`` is empty the service does not try to
connect anywhere — it logs the reset CODE at DEBUG level instead, so the flow
stays fully testable on a developer machine without a mailbox.
"""

from __future__ import annotations

import logging

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from pydantic import SecretStr

from app.config import settings

logger = logging.getLogger("backend.email")

# Акцентный цвет проекта — единый с фронтендом.
_ACCENT = "#E11D48"


def _build_reset_html(code: str) -> str:
    """Минимальный HTML-шаблон письма с 6-значным кодом сброса в палитре проекта."""
    return f"""\
<!DOCTYPE html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:16px;
                padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">
        Fin<span style="color:{_ACCENT};">Track</span>
      </h1>
      <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a;">Сброс пароля</h2>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
        Мы получили запрос на сброс пароля для вашего аккаунта.
        Введите код ниже на странице сброса пароля.
      </p>
      <div style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;
                  color:{_ACCENT};padding:14px 28px;border-radius:12px;font-size:30px;
                  font-weight:700;letter-spacing:8px;">
        {code}
      </div>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Код действителен 15 минут. Если вы не запрашивали сброс пароля,
        просто проигнорируйте это письмо — ваш пароль не изменится.
      </p>
    </div>
  </body>
</html>
"""


def _smtp_configured() -> bool:
    return bool(settings.smtp_host)


def _build_mailer() -> FastMail:
    """Собрать FastMail-клиент из настроек. Вызывается только при настроенном SMTP."""
    logger.debug(
        "[email_service] init mailer host=%s port=%d user=%s from=%s",
        settings.smtp_host,
        settings.smtp_port,
        "present" if settings.smtp_user else "ABSENT",
        settings.smtp_from,
    )
    config = ConnectionConfig(
        MAIL_USERNAME=settings.smtp_user,
        MAIL_PASSWORD=SecretStr(settings.smtp_password),
        MAIL_FROM=settings.smtp_from,
        MAIL_PORT=settings.smtp_port,
        MAIL_SERVER=settings.smtp_host,
        MAIL_FROM_NAME="FinTrack",
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=bool(settings.smtp_user),
        VALIDATE_CERTS=True,
    )
    return FastMail(config)


async def send_reset_code(to: str, code: str) -> None:
    """Отправить письмо с 6-значным кодом сброса пароля.

    При пустом ``smtp_host`` письмо не отправляется — код логируется в DEBUG
    (graceful degradation для локальной разработки). Ошибки SMTP логируются и
    пробрасываются вызывающему коду.
    """
    if not _smtp_configured():
        logger.debug(
            "[email_service] SMTP not configured; reset code for %s: %s",
            to,
            code,
        )
        return

    logger.debug("[email_service] sending reset code email to %s", to)
    message = MessageSchema(
        subject="FinTrack — код сброса пароля",
        recipients=[to],
        body=_build_reset_html(code),
        subtype=MessageType.html,
    )
    mailer = _build_mailer()
    await mailer.send_message(message)
    logger.info("[email_service] reset code email sent to %s", to)
