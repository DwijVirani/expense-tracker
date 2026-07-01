import json
import logging
import sys
from uuid import UUID as StdUUID

from bson import ObjectId


class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (StdUUID, ObjectId)):
            return str(obj)
        return super().default(obj)


class StructuredLogger:
    def __init__(self, logger: logging.Logger):
        self._logger = logger

    def format_message(self, message: str, **kwargs) -> str:
        """Formats the message and additional keyword arguments into a structured JSON string."""
        if kwargs:
            return f"{message} | {json.dumps(kwargs, cls=UUIDEncoder)}"
        return message

    def debug(self, message: str, **kwargs) -> None:
        self._logger.debug(self.format_message(message, **kwargs))

    def info(self, message: str, **kwargs) -> None:
        self._logger.info(self.format_message(message, **kwargs))

    def warning(self, message: str, **kwargs) -> None:
        self._logger.warning(self.format_message(message, **kwargs))

    def error(self, message: str, exec_info: bool = False, **kwargs) -> None:
        self._logger.error(self.format_message(message, **kwargs), exc_info=exec_info)

    def critical(self, message: str, exec_info: bool = False, **kwargs) -> None:
        self._logger.critical(
            self.format_message(message, **kwargs), exc_info=exec_info
        )


def setup_logging(log_level: str = "INFO") -> None:
    """Sets up logging with a structured JSON format."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )

    logging.getLogger("uvicorn").setLevel(logging.WARNING)


def get_logger(name: str) -> StructuredLogger:
    """Returns a structured logger for the given name."""
    logger = logging.getLogger(name)
    return StructuredLogger(logger)
