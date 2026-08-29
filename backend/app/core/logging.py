import logging

from app.core.config import settings

_NOISY = ("httpx", "httpcore", "hpack", "h2", "urllib3", "postgrest", "hpack.hpack")

_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    level = logging.DEBUG if settings.debug else logging.INFO
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        root.addHandler(handler)
    root.setLevel(logging.INFO)

    logging.getLogger("hrms").setLevel(level)
    for name in _NOISY:
        lg = logging.getLogger(name)
        lg.setLevel(logging.WARNING)
        lg.propagate = True


logger = logging.getLogger("hrms")
