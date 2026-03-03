from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

from app.core.config import Settings


def configure_logging(settings: Settings) -> None:
    level_name = settings.log_level.upper()
    level = getattr(logging, level_name, logging.INFO)
    log_path = Path(settings.log_file)

    if settings.log_per_run:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        log_path = log_path.with_name(f"{log_path.stem}-{stamp}{log_path.suffix}")

    if not log_path.is_absolute():
        log_path = Path.cwd() / log_path
    log_path.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)
    root.addHandler(file_handler)
