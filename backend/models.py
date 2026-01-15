from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    categories = relationship("Category", back_populates="owner", cascade="all, delete-orphan")
    exercises = relationship("Exercise", back_populates="owner", cascade="all, delete-orphan")
    records = relationship("Record", back_populates="owner", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="categories")
    exercises = relationship("Exercise", back_populates="category")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="exercises")
    category = relationship("Category", back_populates="exercises")
    records = relationship("Record", back_populates="exercise")


class Record(Base):
    __tablename__ = "workout_records"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    exercise_name = Column(String)
    weight = Column(Float, default=0)
    reps = Column(Integer, default=0)
    sets = Column(Integer, default=1)
    memo = Column(String, nullable=True)  # メモ欄を追加
    volume = Column(Float, default=0)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="records")
    exercise = relationship("Exercise", back_populates="records")

