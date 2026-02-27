from pydantic import BaseModel
from datetime import date

class SurveyResultCreate(BaseModel):
    class_id: int
    date: date
    walked_count: int
    total_students: int

class SurveyResultOut(BaseModel):
    class_id: int
    date: date
    walked_count: int
    total_students: int
    class_name: str
    group_id: int
    group_name: str

class LeaderboardEntry(BaseModel):
    group_id: int
    group_name: str
    class_id: int
    class_name: str
    walked_total: int
    total_students: int
    percent_walked: float
