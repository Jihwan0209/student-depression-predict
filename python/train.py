# 요청 데이터 gender, age, academicPressure, gpa, studySatisfaction, sleepDuration, dietaryHabits, workStudyHours, financialStress

# 응답 데이터
# event	언제	data 예시
# progress	단계마다	{"step":2,"total":4,"message":"입력값 전처리 중"}
# result	예측 완료	{"prediction":1,"probability":0.73,"label":"우울 위험 높음","metrics":{"f1":0.85}}
# error	문제 발생	{"code":"INVALID_INPUT","message":"sleepDuration 값이 올바르지 않습니다"}
# done	마지막	{}

import pandas as pd
import optuna
import joblib
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import f1_score

# 1. 데이터 불러오기
df = pd.read_csv('./Student Depression Dataset.csv')

# 2. 행 정리
df = df[df['Profession'] == 'Student']
df = df[(df['Sleep Duration'] != 'Others') & (df['Dietary Habits'] != 'Others')]
df = df.dropna()

# 3. 컬럼 선택
num_cols = ['Age', 'CGPA', 'Academic Pressure', 'Study Satisfaction', 'Work/Study Hours', 'Financial Stress']
cat_cols = ['Gender', 'Sleep Duration', 'Dietary Habits']

X = df[num_cols + cat_cols].copy()
y = df['Depression']

# 4. 범주형 변환 (허용 값을 직접 지정)
categories = {
    'Gender': ['Female', 'Male'],
    'Sleep Duration': ['Less than 5 hours', '5-6 hours', '7-8 hours', 'More than 8 hours'],
    'Dietary Habits': ['Unhealthy', 'Moderate', 'Healthy'],
}
for col in cat_cols:
    X[col] = pd.Categorical(X[col], categories=categories[col])

# 5. 학습 / 검증 분할
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

# 6. Optuna로 하이퍼파라미터 탐색 (학습 데이터 안에서 5겹 교차검증)
def objective(trial):
    params = {
        'n_estimators': trial.suggest_int('n_estimators', 100, 1000),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
        'num_leaves': trial.suggest_int('num_leaves', 15, 127),
        'max_depth': trial.suggest_int('max_depth', 3, 12),
        'min_child_samples': trial.suggest_int('min_child_samples', 10, 100),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'subsample_freq': 1,
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
        'random_state': 42,
        'verbose': -1,
    }
    model = LGBMClassifier(**params)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='f1')
    return scores.mean()

study = optuna.create_study(direction='maximize')
study.optimize(objective, n_trials=50)

print('best CV F1:', study.best_value)
print('best params:', study.best_params)

# 7. best_params로 최종 모델 학습
final_model = LGBMClassifier(**study.best_params, subsample_freq=1, random_state=42, verbose=-1)
final_model.fit(X_train, y_train)

# 8. 검증 데이터로 F1 평가
y_pred = final_model.predict(X_val)
val_f1 = f1_score(y_val, y_pred)
print('validation F1:', val_f1)

# 9. 저장 (모델 + 성능 지표 + 범주 정보)
joblib.dump({
    'model': final_model,
    'f1_score': val_f1,
    'num_cols': num_cols,
    'cat_cols': cat_cols,
    'categories': categories,
}, './depression_model.pkl')
print('saved: depression_model.pkl')