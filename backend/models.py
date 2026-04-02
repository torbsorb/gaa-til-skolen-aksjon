from sqlalchemy import Column, Integer, String, Date, ForeignKey, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class ClassGroup(Base):
    __tablename__ = "class_groups"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    # Relationship: classes in this group
    classes = relationship("SchoolClass", back_populates="group")

class SchoolClass(Base):
    __tablename__ = "school_classes"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    group_id = Column(Integer, ForeignKey("class_groups.id"))
    total_students = Column(Integer, nullable=False)
    logo_data = Column(LargeBinary, nullable=True)  # Stores uploaded logo or None for default
    group = relationship("ClassGroup", back_populates="classes")
    # Relationship: survey results
    results = relationship("SurveyResult", back_populates="school_class")

class SurveyResult(Base):
    __tablename__ = "survey_results"
    id = Column(Integer, primary_key=True)
    class_id = Column(Integer, ForeignKey("school_classes.id"))
    date = Column(Date, nullable=False)
    walked_count = Column(Integer, nullable=False)
    total_students = Column(Integer, nullable=False)
    school_class = relationship("SchoolClass", back_populates="results")


class CellEditAudit(Base):
    __tablename__ = "cell_edit_audit"
    id = Column(Integer, primary_key=True)
    class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    date = Column(Date, nullable=False)
    edit_count = Column(Integer, nullable=False, default=0)
