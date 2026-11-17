# 요청 데이터 gender, age, academicPressure, gpa, studySatifaction, sleepDuration, dietaryHabits, workStudyHours, financialStress

# 응답 데이터
# event	언제	data 예시
# progress	단계마다	{"step":2,"total":4,"message":"입력값 전처리 중"}
# result	예측 완료	{"prediction":1,"probability":0.73,"label":"우울 위험 높음","metrics":{"f1":0.85}}
# error	문제 발생	{"code":"INVALID_INPUT","message":"sleepDuration 값이 올바르지 않습니다"}
# done	마지막	{}