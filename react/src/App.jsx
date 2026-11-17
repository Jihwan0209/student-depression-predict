import { useEffect, useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8080/api/depression'

const INITIAL_FORM = {
  gender: 'Male',
  age: 21,
  academicPressure: 3,
  gpa: 3.5,
  studySatisfaction: 3,
  sleepDuration: '7-8 hours',
  dietaryHabits: 'Moderate',
  workStudyHours: 6,
  financialStress: 3,
}

const GENDER = [
  { value: 'Male', label: '남성' },
  { value: 'Female', label: '여성' },
]
const SLEEP = [
  { value: 'Less than 5 hours', label: '5시간 미만' },
  { value: '5-6 hours', label: '5~6시간' },
  { value: '7-8 hours', label: '7~8시간' },
  { value: 'More than 8 hours', label: '8시간 초과' },
]
const DIET = [
  { value: 'Unhealthy', label: '불규칙' },
  { value: 'Moderate', label: '보통' },
  { value: 'Healthy', label: '건강함' },
]

// SSE 텍스트 한 덩어리("event:..\ndata:..") 에서 data 부분만 JSON 으로 꺼냄
function parseEvent(raw) {
  const data = raw
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5))
    .join('\n')
    .trim()
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [steps, setSteps] = useState([])
  const [total, setTotal] = useState(4)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Spring 은 모든 이벤트를 'predict' 이름으로 보내므로 data 모양으로 구분
  function handleData(d) {
    if (!d) return
    if ('step' in d) {
      setTotal(d.total)
      setSteps((prev) => [...prev.filter((s) => s.step !== d.step), d].sort((a, b) => a.step - b.step))
      setStatus((s) => (s === 'idle' ? 'running' : s))
    } else if ('prediction' in d) {
      setResult(d)
    } else if ('code' in d) {
      setError(d.message)
      setStatus('error')
    } else {
      // {} : done
      setStatus((s) => (s === 'error' ? 'error' : 'done'))
    }
  }

  // 1. 화면이 열리면 Spring SSE 구독 (axios 로 스트림 수신)
  useEffect(() => {
    const controller = new AbortController()
    let retryTimer

    function subscribe() {
      let seen = 0
      let buffer = ''
      setConnected(true)
      axios
        .get(`${API}/subscribe`, {
          adapter: 'xhr',
          responseType: 'text',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
          // 데이터가 들어올 때마다 호출됨 -> 새로 들어온 부분만 잘라서 이벤트 단위로 처리
          onDownloadProgress: (e) => {
            const text = e.event?.target?.responseText ?? ''
            buffer += text.slice(seen).replace(/\r\n/g, '\n')
            seen = text.length
            let idx
            while ((idx = buffer.indexOf('\n\n')) >= 0) {
              handleData(parseEvent(buffer.slice(0, idx)))
              buffer = buffer.slice(idx + 2)
            }
          },
        })
        .catch(() => {})
        .finally(() => {
          // 연결이 끊기면 (서버 종료/타임아웃) 2초 후 재연결
          if (controller.signal.aborted) return
          setConnected(false)
          retryTimer = setTimeout(subscribe, 2000)
        })
    }

    subscribe()
    return () => {
      controller.abort()
      clearTimeout(retryTimer)
    }
  }, [])

  // 2. 예측 요청 (결과는 위 구독으로 들어옴)
  async function handleSubmit(e) {
    e.preventDefault()
    setSteps([])
    setResult(null)
    setError('')
    setStatus('running')
    try {
      await axios.post(`${API}/predict`, {
        ...form,
        age: Number(form.age),
        gpa: Number(form.gpa),
        workStudyHours: Number(form.workStudyHours),
      })
    } catch {
      setError('Spring 서버에 연결할 수 없습니다. 서버가 켜져 있는지 확인해 주세요.')
      setStatus('error')
    }
  }

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const running = status === 'running'
  const lastStep = steps.length ? steps[steps.length - 1].step : 0
  const percent = status === 'done' ? 100 : Math.round((lastStep / total) * 100)

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>학생 우울 위험 예측</h1>
          <p className="sub">생활 습관과 학업 정보를 입력하면 LightGBM 모델이 우울 위험도를 예측합니다.</p>
        </div>
        <span className={`conn ${connected ? 'on' : 'off'}`}>
          <i />
          {connected ? '서버 연결됨' : '서버 연결 끊김'}
        </span>
      </header>

      <main className="grid">
        <form className="card form" onSubmit={handleSubmit}>
          <h2>기본 정보</h2>
          <div className="row two">
            <Field label="성별">
              <Segment options={GENDER} value={form.gender} onChange={set('gender')} />
            </Field>
            <Field label="나이" hint="18 ~ 59세">
              <input type="number" min={18} max={59} required value={form.age}
                onChange={(e) => set('age')(e.target.value)} />
            </Field>
          </div>

          <h2>학업</h2>
          <div className="row two">
            <Field label="학점" hint="4.5 만점">
              <input type="number" min={0} max={4.5} step={0.01} required value={form.gpa}
                onChange={(e) => set('gpa')(e.target.value)} />
            </Field>
            <Field label="하루 공부·일 시간" hint={`${form.workStudyHours}시간`}>
              <input type="range" min={0} max={12} value={form.workStudyHours}
                onChange={(e) => set('workStudyHours')(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="학업 압박감">
            <Scale value={form.academicPressure} onChange={set('academicPressure')} low="낮음" high="높음" />
          </Field>
          <Field label="학업 만족도">
            <Scale value={form.studySatisfaction} onChange={set('studySatisfaction')} low="불만족" high="만족" />
          </Field>

          <h2>생활</h2>
          <Field label="하루 수면 시간">
            <Segment options={SLEEP} value={form.sleepDuration} onChange={set('sleepDuration')} />
          </Field>
          <Field label="식습관">
            <Segment options={DIET} value={form.dietaryHabits} onChange={set('dietaryHabits')} />
          </Field>
          <Field label="경제적 스트레스">
            <Scale value={form.financialStress} onChange={set('financialStress')} low="낮음" high="높음" />
          </Field>

          <button className="submit" type="submit" disabled={running || !connected}>
            {running ? '예측 중…' : '예측하기'}
          </button>
        </form>

        <section className="side">
          <div className="card">
            <h2>진행 상태</h2>
            {status === 'idle' ? (
              <p className="empty">정보를 입력하고 ‘예측하기’를 눌러 주세요.</p>
            ) : (
              <>
                <div className="bar"><span style={{ width: `${percent}%` }} /></div>
                <ol className="steps">
                  {steps.map((s) => {
                    const active = running && s.step === lastStep && !result
                    return (
                      <li key={s.step} className={active ? 'active' : 'done'}>
                        <span className="dot">{active ? '' : '✓'}</span>
                        {s.message}
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
            {error && <p className="error">⚠ {error}</p>}
          </div>

          {result && <ResultCard result={result} />}
        </section>
      </main>
    </div>
  )
}

function ResultCard({ result }) {
  const pct = Math.round(result.probability * 100)
  const high = result.prediction === 1
  return (
    <div className={`card result ${high ? 'high' : 'low'}`}>
      <h2>예측 결과</h2>
      <div className="score">
        <strong>{pct}<small>%</small></strong>
        <span className="pill">{result.label}</span>
      </div>
      <div className="gauge"><span style={{ width: `${pct}%` }} /></div>
      <p className="gauge-label">우울 위험 확률</p>

      <div className="metric">
        <span>모델 성능 (검증 F1-Score)</span>
        <b>{result.metrics.f1.toFixed(3)}</b>
      </div>

      <p className="notice">
        이 결과는 학습된 모델의 참고용 예측이며 의학적 진단이 아닙니다.
        {high && ' 마음이 힘들다면 가까운 사람이나 전문가와 이야기해 보세요. (자살예방상담전화 109, 24시간)'}
      </p>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="label">
        <span>{label}</span>
        {hint && <em>{hint}</em>}
      </div>
      {children}
    </div>
  )
}

function Segment({ options, value, onChange }) {
  return (
    <div className="segment">
      {options.map((o) => (
        <button type="button" key={o.value} className={o.value === value ? 'selected' : ''}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Scale({ value, onChange, low, high }) {
  return (
    <div className="scale">
      <span>{low}</span>
      <div className="segment">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} className={n === value ? 'selected' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <span>{high}</span>
    </div>
  )
}
