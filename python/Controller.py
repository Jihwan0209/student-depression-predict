#[1] 라우터: 특정 도메인(주소) 묶어주는 역할
import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api")

# 서비스 객체 불러오기 # from 파일명 import 변수명
from Service import predict_service


# 1) 일반 예측 (JSON 응답) - /docs 에서 테스트용
# http://127.0.0.1:8000/api/predict
# {"gender":"Male","age":22,"academicPressure":5,"gpa":7.5,"studySatisfaction":1,
#  "sleepDuration":"Less than 5 hours","dietaryHabits":"Unhealthy",
#  "workStudyHours":10,"financialStress":5}
@router.post("/predict")
async def predict(data: dict):
    return predict_service.predict(data)


# SSE 이벤트 한 개를 문자열로 만드는 함수
# 형식 : "event: 이벤트명\ndata: JSON\n\n"  (마지막 빈 줄이 이벤트 구분자)
def sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# 2) 스트리밍 예측 (SSE 응답) - Spring Boot WebClient 가 호출하는 주소
# http://127.0.0.1:8000/api/predict/stream
# 응답 순서 : progress(1~4) -> result 또는 error -> done
@router.post("/predict/stream")
async def predict_stream(data: dict):
    # 비동기 제너레이터 : yield 할 때마다 이벤트가 하나씩 클라이언트로 전송됨
    async def generate():
        total = 4
        try:
            yield sse("progress", {"step": 1, "total": total, "message": "요청 데이터 수신"})
            await asyncio.sleep(0.5)  # 진행 상태가 화면에 보이도록 잠깐 대기

            yield sse("progress", {"step": 2, "total": total, "message": "입력값 검증 및 전처리 중"})
            error = predict_service.validate(data)
            if error:
                yield sse("error", {"code": "INVALID_INPUT", "message": error})
                return  # finally 의 done 은 실행됨
            df = predict_service.to_dataframe(data)
            await asyncio.sleep(0.5)

            yield sse("progress", {"step": 3, "total": total, "message": "LightGBM 모델 예측 중"})
            result = predict_service.predict_df(df)
            await asyncio.sleep(0.5)

            yield sse("progress", {"step": 4, "total": total, "message": "예측 완료"})
            yield sse("result", result)
        except Exception as e:
            yield sse("error", {"code": "PREDICTION_FAILED", "message": str(e)})
        finally:
            yield sse("done", {})

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})
