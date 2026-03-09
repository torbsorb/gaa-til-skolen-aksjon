from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "survey.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)
