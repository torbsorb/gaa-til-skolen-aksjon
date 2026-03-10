from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
import os

DB_PATH = Path(__file__).resolve().parent / "survey.db"
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{DB_PATH}"

# Some platforms provide postgres://, but SQLAlchemy expects postgresql://
if DATABASE_URL.startswith("postgres://"):
	DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


def _ensure_postgres_sslmode(db_url: str) -> str:
	if not db_url.startswith("postgresql://"):
		return db_url

	parsed = urlparse(db_url)
	host = (parsed.hostname or "").lower()
	default_sslmode = "disable" if host in {"localhost", "127.0.0.1"} else "require"

	query = dict(parse_qsl(parsed.query, keep_blank_values=True))
	query.setdefault("sslmode", os.getenv("PGSSLMODE", default_sslmode))
	return urlunparse(parsed._replace(query=urlencode(query)))


DATABASE_URL = _ensure_postgres_sslmode(DATABASE_URL)

if DATABASE_URL.startswith("sqlite"):
	engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
	# pre_ping avoids stale connections in long-running cloud deployments
	engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)
