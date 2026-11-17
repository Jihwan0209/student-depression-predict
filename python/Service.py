# 비지니스 로직 == 머신러닝 모델 예측
import os
import joblib
import pandas as pd

# 요청 JSON 키(camelCase) -> 학습 데이터셋 컬럼명
KEY_TO_COLUMN = {
    'gender': 'Gender',
    'age': 'Age',
    'academicPressure': 'Academic Pressure',
    'gpa': 'CGPA',
    'studySatisfaction': 'Study Satisfaction',
    'sleepDuration': 'Sleep Duration',
    'dietaryHabits': 'Dietary Habits',
    'workStudyHours': 'Work/Study Hours',
    'financialStress': 'Financial Stress',
}

# 학점 환산 : 요청은 한국식 4.5 만점, 학습 데이터 CGPA 는 10 만점
GPA_MAX = 4.5
CGPA_MAX = 10.0

# 모델 파일 경로 : 이 파일(python/Service.py) 기준 한 단계 위 폴더의 depression_model.pkl
# -> 어느 폴더에서 서버를 실행해도 같은 파일을 찾음
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'depression_model.pkl')


class PredictService:
    # 생성자 : 서버 시작 시 한 번만 실행 -> 모델을 메모리에 로드 (요청마다 재학습 X)
    def __init__(self):
        saved = joblib.load(MODEL_PATH)
        self.model = saved['model']
        self.f1 = round(float(saved['f1_score']), 4)
        self.num_cols = saved['num_cols']
        self.cat_cols = saved['cat_cols']
        self.categories = saved['categories']
        # 모델이 실제로 학습한 컬럼에 해당하는 요청 키만 사용
        used_cols = self.num_cols + self.cat_cols
        self.keys = {key: col for key, col in KEY_TO_COLUMN.items() if col in used_cols}
        print(f'모델 로드 완료 (검증 F1 = {self.f1}, 입력 키 = {list(self.keys)})')

    # 입력값 검증 : 문제가 있으면 에러 메시지 반환, 없으면 None
    def validate(self, data):
        # 1. 빠진 키 확인
        for key in self.keys:
            if key not in data:
                return f'{key} 값이 없습니다'
        # 2. 수치형은 숫자인지 확인
        for key, col in self.keys.items():
            if col in self.num_cols:
                try:
                    float(data[key])
                except (TypeError, ValueError):
                    return f'{key} 값은 숫자여야 합니다'
        # 2-1. 학점은 0 ~ 4.5 범위인지 확인
        if 'gpa' in self.keys and not 0 <= float(data['gpa']) <= GPA_MAX:
            return f'gpa 값은 0 ~ {GPA_MAX} 사이여야 합니다'
        # 3. 범주형은 학습 때 허용한 값인지 확인
        for key, col in self.keys.items():
            if col in self.cat_cols and data[key] not in self.categories[col]:
                return f'{key} 값이 올바르지 않습니다 (허용: {self.categories[col]})'
        return None

    # 요청 dict -> 학습 때와 같은 모양의 DataFrame
    def to_dataframe(self, data):
        # 1. 키 이름을 데이터셋 컬럼명으로 변경
        row = {col: data[key] for key, col in self.keys.items()}
        # 1-1. 학점 환산 : 4.5 만점 -> 10 만점 (예: 4.0 -> 8.89)
        if 'CGPA' in row:
            row['CGPA'] = float(row['CGPA']) / GPA_MAX * CGPA_MAX
        # 2. 한 줄짜리 df 생성, 컬럼 순서를 학습 때와 동일하게 (num_cols + cat_cols)
        df = pd.DataFrame([row])[self.num_cols + self.cat_cols]
        # 3. 수치형은 float, 범주형은 학습 때와 같은 범주 목록으로 고정
        for col in self.num_cols:
            df[col] = df[col].astype(float)
        for col in self.cat_cols:
            df[col] = pd.Categorical(df[col], categories=self.categories[col])
        return df

    # 예측 : 확률 계산 후 결과 dict 반환
    def predict_df(self, df):
        probability = float(self.model.predict_proba(df)[0][1])  # 1(우울)일 확률
        prediction = 1 if probability >= 0.5 else 0
        return {
            'prediction': prediction,
            'probability': round(probability, 4),
            'label': '우울 위험 높음' if prediction == 1 else '우울 위험 낮음',
            'metrics': {'f1': self.f1},
        }

    # 일반 JSON 응답용 : 검증 -> 변환 -> 예측을 한 번에
    def predict(self, data):
        error = self.validate(data)
        if error:
            return {'code': 'INVALID_INPUT', 'message': error}
        return self.predict_df(self.to_dataframe(data))


###########################################################
# 서비스 객체 생성 (import 될 때 한 번 생성 -> 모델 한 번 로드)
predict_service = PredictService()
