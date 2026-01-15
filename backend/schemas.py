from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ========== Auth Schemas ==========
class UserCreate(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


# ========== Category Schemas ==========
class CategoryCreate(BaseModel):
    name: str


class CategoryResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# ========== Exercise Schemas ==========
class ExerciseCreate(BaseModel):
    name: str
    category_id: Optional[int] = None


class ExerciseUpdate(BaseModel):
    category_id: Optional[int] = None


class ExerciseResponse(BaseModel):
    id: int
    name: str
    category_id: Optional[int] = None

    class Config:
        from_attributes = True


# ========== Record Schemas ==========
class RecordCreate(BaseModel):
    date: str
    exercise_id: int
    weight: float = 0
    reps: int = 0
    sets: int = 1


class RecordResponse(BaseModel):
    id: int
    date: str
    exercise_id: int
    exercise_name: str
    weight: float
    reps: int
    sets: int
    volume: float

    class Config:
        from_attributes = True


# ========== Stats Schemas ==========
class StatsResponse(BaseModel):
    total_workouts: int
    total_volume: int
    max_weight: float
