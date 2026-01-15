from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

import models
import schemas
from database import engine, get_db
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Workout Tracker API",
    description="ワークアウト記録管理API",
    version="1.0.0"
)

# Root endpoint for health check
@app.get("/")
def read_root():
    return {"message": "Workout Tracker API is running!"}

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切なオリジンを指定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== Auth Endpoints ==========
@app.post("/auth/register", response_model=schemas.UserResponse)
async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """ユーザー登録"""
    # Check if email already exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に使用されています"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Add default exercises
    default_exercises = [
        "ベンチプレス", "スクワット", "デッドリフト",
        "懸垂", "ショルダープレス", "バーベルロー"
    ]
    for name in default_exercises:
        exercise = models.Exercise(name=name, user_id=new_user.id)
        db.add(exercise)
    db.commit()
    
    return new_user


@app.post("/auth/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """ログイン（JWTトークン発行）"""
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが間違っています",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(get_current_user)):
    """現在のユーザー情報を取得"""
    return current_user


# ========== Category Endpoints ==========
@app.get("/categories", response_model=List[schemas.CategoryResponse])
async def get_categories(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """カテゴリ一覧を取得"""
    return db.query(models.Category).filter(models.Category.user_id == current_user.id).all()


@app.post("/categories", response_model=schemas.CategoryResponse)
async def create_category(
    category: schemas.CategoryCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """カテゴリを作成"""
    new_category = models.Category(name=category.name, user_id=current_user.id)
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category


@app.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """カテゴリを削除"""
    category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.user_id == current_user.id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="カテゴリが見つかりません")
    
    # Remove category from exercises
    exercises = db.query(models.Exercise).filter(models.Exercise.category_id == category_id).all()
    for ex in exercises:
        ex.category_id = None
    
    db.delete(category)
    db.commit()
    return {"message": "削除しました"}


# ========== Exercise Endpoints ==========
@app.get("/exercises", response_model=List[schemas.ExerciseResponse])
async def get_exercises(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """エクササイズ一覧を取得"""
    return db.query(models.Exercise).filter(models.Exercise.user_id == current_user.id).all()


@app.post("/exercises", response_model=schemas.ExerciseResponse)
async def create_exercise(
    exercise: schemas.ExerciseCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """エクササイズを作成"""
    new_exercise = models.Exercise(
        name=exercise.name,
        category_id=exercise.category_id,
        user_id=current_user.id
    )
    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)
    return new_exercise


@app.put("/exercises/{exercise_id}", response_model=schemas.ExerciseResponse)
async def update_exercise(
    exercise_id: int,
    exercise_update: schemas.ExerciseUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """エクササイズを更新（カテゴリ変更）"""
    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == exercise_id,
        models.Exercise.user_id == current_user.id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="エクササイズが見つかりません")
    
    exercise.category_id = exercise_update.category_id
    db.commit()
    db.refresh(exercise)
    return exercise


@app.delete("/exercises/{exercise_id}")
async def delete_exercise(
    exercise_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """エクササイズを削除"""
    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == exercise_id,
        models.Exercise.user_id == current_user.id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="エクササイズが見つかりません")
    
    db.delete(exercise)
    db.commit()
    return {"message": "削除しました"}


# ========== Record Endpoints ==========
@app.get("/records", response_model=List[schemas.RecordResponse])
async def get_records(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ワークアウト記録一覧を取得"""
    return db.query(models.Record).filter(models.Record.user_id == current_user.id).all()


@app.post("/records", response_model=schemas.RecordResponse)
async def create_record(
    record: schemas.RecordCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ワークアウト記録を作成"""
    # Get exercise name
    exercise = db.query(models.Exercise).filter(
        models.Exercise.id == record.exercise_id,
        models.Exercise.user_id == current_user.id
    ).first()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="エクササイズが見つかりません")
    
    volume = record.weight * record.reps * record.sets
    
    new_record = models.Record(
        date=record.date,
        exercise_id=record.exercise_id,
        exercise_name=exercise.name,
        weight=record.weight,
        reps=record.reps,
        sets=record.sets,
        volume=volume,
        user_id=current_user.id
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


@app.delete("/records/{record_id}")
async def delete_record(
    record_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ワークアウト記録を削除"""
    record = db.query(models.Record).filter(
        models.Record.id == record_id,
        models.Record.user_id == current_user.id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="記録が見つかりません")
    
    db.delete(record)
    db.commit()
    return {"message": "削除しました"}


# ========== Stats Endpoint ==========
@app.get("/stats", response_model=schemas.StatsResponse)
async def get_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """統計データを取得"""
    records = db.query(models.Record).filter(models.Record.user_id == current_user.id).all()
    
    unique_dates = set(r.date for r in records)
    total_volume = sum(r.volume or 0 for r in records)
    max_weight = max((r.weight or 0 for r in records), default=0)
    
    return {
        "total_workouts": len(unique_dates),
        "total_volume": int(total_volume),
        "max_weight": max_weight
    }


# ========== Health Check ==========
@app.get("/")
async def root():
    """ヘルスチェック"""
    return {"status": "ok", "message": "Workout Tracker API is running"}
