import { useEffect, useState } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8080/api/depression'
const STEPS = ['요청 데이터 수신', '입력값 검증 및 전처리', 'LightGBM 모델 예측', '예측 완료']

export default function App() {
  // 접속자 구분번호 ( 요청한 화면에만 결과가 오게 함 )
  const [id] = useState(() => Math.random().toString(36).slice(2))
  // 입력값
  const [form, setForm] = useState({
    gender: 'Male', age: 22, academicPressure: 3, gpa: 7.5, studySatisfaction: 3,
    sleepDuration: '5-6 hours', dietaryHabits: 'Moderate', workStudyHours: 6, financialStress: 3,
  })
  const [progress, setProgress] = useState(null) // 진행 상황
  const [result, setResult] = useState(null)     // 예측 결과
  const [error, setError] = useState(null)       // 에러
  const [loading, setLoading] = useState(false)

  // 1. 화면이 열리면 SSE 구독 ( 스프링이 보내는 predict 이벤트 수신 )
  useEffect(() => {
    const es = new EventSource(`${BASE}/subscribe?id=${id}`)
    es.addEventListener('predict', (e) => {
      const data = JSON.parse(e.data)
      // 스프링은 이벤트 이름이 전부 predict 이므로 JSON 안의 값으로 구분
      if (data.step !== undefined) setProgress(data)            // 진행 중
      else if (data.prediction !== undefined) setResult(data)   // 결과
      else if (data.code !== undefined) setError(data)          // 에러
      else setLoading(false)                                    // {} = 끝
    })
    return () => es.close()
  }, [])

  const change = (e) => {
    const { name, value, type } = e.target
    setForm({ ...form, [name]: type === 'number' ? Number(value) : value })
  }

  // 2. 예측 요청 ( axios POST , 결과는 위 SSE 로 도착 )
  const predict = async () => {
    setProgress(null); setResult(null); setError(null); setLoading(true)
    try { await axios.post(`${BASE}/predict?id=${id}`, form) }
    catch (e) { setError({ message: '스프링 서버 연결 실패' }); setLoading(false) }
  }

  const step = progress ? progress.step : 0
  const total = progress ? progress.total : 4

  return (
    <div className="wrap">
      <div className="header">
        <span className="badge">LightGBM · Optuna · 실시간 SSE</span>
        <h1>대학생 우울 위험 예측</h1>
        <p>생활·학업 정보를 입력하면 AI 모델이 실시간으로 우울 위험도를 예측합니다</p>
        <div className="flow"><span>React</span>→<span>Spring (WebClient)</span>→<span>FastAPI</span>→<span>LightGBM</span></div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>📝 설문 입력</h2>
          <div className="fields">
            <div className="field"><label>성별</label>
              <select name="gender" value={form.gender} onChange={change}>
                <option value="Male">남성</option><option value="Female">여성</option>
              </select></div>
            <div className="field"><label>나이</label>
              <input type="number" name="age" value={form.age} onChange={change} /></div>
            <div className="field"><label>학업 압박감 <small>(0~5)</small></label>
              <input type="number" name="academicPressure" min="0" max="5" value={form.academicPressure} onChange={change} /></div>
            <div className="field"><label>학점 CGPA <small>(0~10)</small></label>
              <input type="number" step="0.1" name="gpa" value={form.gpa} onChange={change} /></div>
            <div className="field"><label>학업 만족도 <small>(0~5)</small></label>
              <input type="number" name="studySatisfaction" min="0" max="5" value={form.studySatisfaction} onChange={change} /></div>
            <div className="field"><label>경제적 스트레스 <small>(1~5)</small></label>
              <input type="number" name="financialStress" min="1" max="5" value={form.financialStress} onChange={change} /></div>
            <div className="field"><label>수면 시간</label>
              <select name="sleepDuration" value={form.sleepDuration} onChange={change}>
                <option value="Less than 5 hours">5시간 미만</option><option value="5-6 hours">5~6시간</option>
                <option value="7-8 hours">7~8시간</option><option value="More than 8 hours">8시간 초과</option>
              </select></div>
            <div className="field"><label>식습관</label>
              <select name="dietaryHabits" value={form.dietaryHabits} onChange={change}>
                <option value="Unhealthy">나쁨</option><option value="Moderate">보통</option><option value="Healthy">좋음</option>
              </select></div>
            <div className="field"><label>하루 공부/일 시간 <small>(0~12)</small></label>
              <input type="number" name="workStudyHours" min="0" max="12" value={form.workStudyHours} onChange={change} /></div>
          </div>
          <button className="btn" onClick={predict} disabled={loading}>
            {loading ? '⏳ 예측 중...' : '🔍 예측하기'}
          </button>
        </div>

        <div className="card">
          <h2>📡 실시간 진행 상황</h2>
          <div className="bar"><div style={{ width: `${(step / total) * 100}%` }} /></div>
          <ul className="steps">
            {STEPS.map((s, i) => (
              <li key={i} className={step > i ? 'done' : ''}>
                <span className="dot">{step > i ? '✓' : i + 1}</span>{s}
              </li>
            ))}
          </ul>

          {result && (
            <div className={`result ${result.prediction === 1 ? 'high' : 'low'}`}>
              <div className="label">{result.label}</div>
              <div className="prob">{(result.probability * 100).toFixed(1)}%</div>
              <div className="meta">우울 확률 · 모델 F1 {result.metrics?.f1}</div>
            </div>
          )}
          {error && <div className="error">⚠️ {error.message}</div>}
          {!progress && !result && !error && <div className="empty">입력 후 예측하기를 눌러주세요</div>}
        </div>
      </div>

      <p className="notice">본 결과는 진단이 아닌 참고용입니다 · 힘들 땐 자살예방상담전화 109</p>
    </div>
  )
}
