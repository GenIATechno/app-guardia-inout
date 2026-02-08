import { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://ifcqzgwassoqtrefkinm.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmY3F6Z3dhc3NvcXRyZWZraW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDE3MTYsImV4cCI6MjA4MzkxNzcxNn0.8uOt18qIhf-r8q62e1WYTnL6rl6TxBozux3qDM90yiU'

async function query(table, options = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`
  if (options.filter) url += `${options.filter}&`
  if (options.order) url += `order=${options.order}&`
  if (options.limit) url += `limit=${options.limit}&`
  const response = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  return response.json()
}

async function insert(table, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  })
  return response.json()
}

async function update(table, id, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  })
  return response.json()
}

const t = { primary: '#F97316', dark: '#09090B', gray: '#18181B', gray2: '#27272A', gray3: '#3F3F46', white: '#FAFAFA', textGray: '#A1A1AA', success: '#22C55E', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6', purple: '#8B5CF6' }

export default function App() {
  const [screen, setScreen] = useState('login')
  const [guardias, setGuardias] = useState([])
  const [instalaciones, setInstalaciones] = useState([])
  const [guardia, setGuardia] = useState(null)
  const [turno, setTurno] = useState(null)
  const [instalacion, setInstalacion] = useState(null)
  const [rondas, setRondas] = useState([])
  const [rondaActiva, setRondaActiva] = useState(null)
  const [reporteTexto, setReporteTexto] = useState('')
  const [reporteTipo, setReporteTipo] = useState('novedad')
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i) }, [])
  useEffect(() => { loadInitial() }, [])

  const loadInitial = async () => {
    const [g, i] = await Promise.all([
      query('is_guardias', { filter: 'activo=eq.true' }),
      query('is_instalaciones', { filter: 'activo=eq.true' })
    ])
    setGuardias(g || [])
    setInstalaciones(i || [])
  }

  const fmt = d => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  const fmtD = d => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  const fmtH = h => h ? h.substring(0,5).replace(':','h') : '--'
  const today = () => new Date().toISOString().split('T')[0]
  const now = () => new Date().toTimeString().split(' ')[0].substring(0,5)

  const doLogin = async (g) => {
    setGuardia(g)
    const turnos = await query('is_turnos', { filter: `guardia_id=eq.${g.id}&fecha=eq.${today()}&estado=eq.activo` })
    if (turnos && turnos.length > 0) {
      const t = turnos[0]
      setTurno(t)
      const inst = instalaciones.find(i => i.id === t.instalacion_id)
      setInstalacion(inst)
      const r = await query('is_rondas', { filter: `turno_id=eq.${t.id}`, order: 'numero.desc' })
      setRondas(r || [])
      setScreen('home')
    } else {
      setScreen('select_instalacion')
    }
  }

  const doCheckin = async (inst) => {
    setLoading(true)
    const turnoData = {
      guardia_id: guardia.id,
      instalacion_id: inst.id,
      fecha: today(),
      turno_tipo: new Date().getHours() < 18 ? 'diurno' : 'nocturno',
      estado: 'activo',
      checkin_timestamp: new Date().toISOString(),
      checkin_hora: now()
    }
    const result = await insert('is_turnos', turnoData)
    if (result && result[0]) {
      setTurno(result[0])
      setInstalacion(inst)
      await insert('is_alertas', {
        instalacion_id: inst.id,
        tipo: 'checkin',
        titulo: `Check-in: ${guardia.nombre} ${guardia.apellido}`,
        mensaje: `Inicio de turno en ${inst.codigo}`,
        prioridad: 'normal'
      })
      setScreen('home')
    }
    setLoading(false)
  }

  const iniciarRonda = async () => {
    setLoading(true)
    const num = rondas.length + 1
    const rondaData = {
      turno_id: turno.id,
      numero: num,
      hora_inicio: now(),
      timestamp_inicio: new Date().toISOString(),
      estado: 'en_curso'
    }
    const result = await insert('is_rondas', rondaData)
    if (result && result[0]) {
      setRondaActiva(result[0])
      setScreen('ronda')
    }
    setLoading(false)
  }

  const finalizarRonda = async (estado = 'ok', obs = '') => {
    setLoading(true)
    await update('is_rondas', rondaActiva.id, {
      hora_fin: now(),
      timestamp_fin: new Date().toISOString(),
      estado: estado,
      observaciones: obs
    })
    const r = await query('is_rondas', { filter: `turno_id=eq.${turno.id}`, order: 'numero.desc' })
    setRondas(r || [])
    setRondaActiva(null)
    setScreen('home')
    setLoading(false)
  }

  const enviarReporte = async () => {
    if (!reporteTexto.trim()) return
    setLoading(true)
    await insert('is_reportes', {
      turno_id: turno.id,
      tipo: reporteTipo,
      descripcion: reporteTexto,
      hora: now(),
      timestamp: new Date().toISOString()
    })
    if (reporteTipo === 'urgente') {
      await insert('is_alertas', {
        instalacion_id: instalacion.id,
        tipo: 'reporte',
        titulo: `⚠️ Reporte Urgente - ${instalacion.codigo}`,
        mensaje: reporteTexto,
        prioridad: 'alta'
      })
    }
    setReporteTexto('')
    setReporteTipo('novedad')
    setScreen('home')
    setLoading(false)
  }

  const doCheckout = async () => {
    if (!confirm('¿Confirmar fin de turno?')) return
    setLoading(true)
    await update('is_turnos', turno.id, {
      estado: 'finalizado',
      checkout_timestamp: new Date().toISOString(),
      checkout_hora: now()
    })
    await insert('is_alertas', {
      instalacion_id: instalacion.id,
      tipo: 'checkout',
      titulo: `Check-out: ${guardia.nombre} ${guardia.apellido}`,
      mensaje: `Fin de turno en ${instalacion.codigo}`,
      prioridad: 'normal'
    })
    setTurno(null)
    setInstalacion(null)
    setRondas([])
    setScreen('login')
    setLoading(false)
  }

  const emergencia = async () => {
    if (!confirm('⚠️ ¿CONFIRMAR EMERGENCIA?')) return
    setLoading(true)
    await insert('is_alertas', {
      instalacion_id: instalacion.id,
      tipo: 'emergencia',
      titulo: `🚨 EMERGENCIA - ${instalacion.codigo}`,
      mensaje: `Alerta activada por ${guardia.nombre} ${guardia.apellido}`,
      prioridad: 'critica'
    })
    alert('Emergencia reportada. Se ha notificado a la central.')
    setLoading(false)
  }

  // LOGIN SCREEN
  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: t.dark, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', marginBottom: 30, marginTop: 40 }}>
        <div style={{ width: 60, height: 60, background: t.primary, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ fontSize: 28 }}>🛡️</span>
        </div>
        <h1 style={{ color: t.white, fontSize: 20, fontWeight: 700, margin: 0 }}>Inout Seguridad</h1>
        <p style={{ color: t.textGray, fontSize: 12, margin: '4px 0 0' }}>App del Guardia</p>
      </div>
      <h2 style={{ color: t.white, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Selecciona tu nombre:</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {guardias.map(g => (
          <button key={g.id} onClick={() => doLogin(g)} style={{ padding: 16, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 10, color: t.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
            {g.nombre} {g.apellido}
          </button>
        ))}
      </div>
    </div>
  )

  // SELECT INSTALACION
  if (screen === 'select_instalacion') return (
    <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: t.textGray, fontSize: 12 }}>Bienvenido</p>
        <h1 style={{ color: t.white, fontSize: 18, fontWeight: 700, margin: 0 }}>{guardia?.nombre} {guardia?.apellido}</h1>
      </div>
      <h2 style={{ color: t.white, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Selecciona instalación para Check-in:</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {instalaciones.map(i => (
          <button key={i.id} onClick={() => doCheckin(i)} disabled={loading} style={{ padding: 16, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 10, color: t.white, cursor: 'pointer', textAlign: 'left', opacity: loading ? 0.5 : 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{i.codigo}</p>
            <p style={{ fontSize: 11, color: t.textGray, margin: '4px 0 0' }}>{i.direccion}</p>
          </button>
        ))}
      </div>
      <button onClick={() => { setGuardia(null); setScreen('login') }} style={{ marginTop: 20, padding: 12, background: 'transparent', border: `1px solid ${t.gray3}`, borderRadius: 8, color: t.textGray, width: '100%', cursor: 'pointer' }}>
        ← Volver
      </button>
    </div>
  )

  // HOME SCREEN
  if (screen === 'home') return (
    <div style={{ minHeight: '100vh', background: t.dark, paddingBottom: 100 }}>
      <header style={{ background: t.gray, padding: 16, borderBottom: `1px solid ${t.gray2}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: t.textGray, fontSize: 10 }}>En servicio</p>
            <h1 style={{ color: t.white, fontSize: 16, fontWeight: 700, margin: 0 }}>{instalacion?.codigo}</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: t.white, fontSize: 18, fontWeight: 600, margin: 0, fontFamily: 'monospace' }}>{fmt(time)}</p>
            <p style={{ color: t.textGray, fontSize: 10, margin: 0 }}>{fmtD(time)}</p>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: 10, background: t.gray2, borderRadius: 8 }}>
          <p style={{ color: t.textGray, fontSize: 10, margin: 0 }}>Guardia</p>
          <p style={{ color: t.white, fontSize: 12, fontWeight: 600, margin: 0 }}>{guardia?.nombre} {guardia?.apellido}</p>
          <p style={{ color: t.success, fontSize: 10, margin: '4px 0 0' }}>✓ Check-in: {fmtH(turno?.checkin_hora)}</p>
        </div>
      </header>

      <main style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: t.gray, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.purple, fontSize: 32, fontWeight: 700, margin: 0 }}>{rondas.length}</p>
            <p style={{ color: t.textGray, fontSize: 10, margin: 0 }}>RONDAS</p>
          </div>
          <div style={{ background: t.gray, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.info, fontSize: 32, fontWeight: 700, margin: 0 }}>{turno?.turno_tipo === 'diurno' ? '☀️' : '🌙'}</p>
            <p style={{ color: t.textGray, fontSize: 10, margin: 0 }}>{turno?.turno_tipo?.toUpperCase()}</p>
          </div>
        </div>

        <button onClick={iniciarRonda} disabled={loading} style={{ width: '100%', padding: 20, background: `linear-gradient(135deg, ${t.primary}, #EA580C)`, border: 'none', borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12, opacity: loading ? 0.5 : 1 }}>
          🚶 INICIAR RONDA
        </button>

        <button onClick={() => setScreen('reporte')} style={{ width: '100%', padding: 16, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 12, color: t.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
          📝 Enviar Reporte
        </button>

        <button onClick={emergencia} disabled={loading} style={{ width: '100%', padding: 16, background: `${t.danger}20`, border: `2px solid ${t.danger}`, borderRadius: 12, color: t.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 20, opacity: loading ? 0.5 : 1 }}>
          🚨 EMERGENCIA
        </button>

        {rondas.length > 0 && (
          <div>
            <h3 style={{ color: t.white, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Rondas de hoy</h3>
            {rondas.slice(0, 5).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: t.gray, borderRadius: 8, marginBottom: 6 }}>
                <span style={{ color: t.white, fontSize: 12 }}>Ronda #{r.numero}</span>
                <span style={{ color: t.textGray, fontSize: 11 }}>{fmtH(r.hora_inicio)} - {fmtH(r.hora_fin)}</span>
                <span style={{ color: r.estado === 'ok' ? t.success : t.warning, fontSize: 10 }}>{r.estado?.toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: t.gray, borderTop: `1px solid ${t.gray2}`, padding: 12 }}>
        <button onClick={doCheckout} disabled={loading} style={{ width: '100%', padding: 14, background: t.gray2, border: 'none', borderRadius: 8, color: t.textGray, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Finalizar Turno (Check-out)
        </button>
      </footer>
    </div>
  )

  // RONDA SCREEN
  if (screen === 'ronda') return (
    <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
      <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 40 }}>
        <div style={{ width: 100, height: 100, background: `${t.primary}20`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: `3px solid ${t.primary}` }}>
          <span style={{ fontSize: 40 }}>🚶</span>
        </div>
        <h1 style={{ color: t.white, fontSize: 24, fontWeight: 700, margin: 0 }}>Ronda #{rondaActiva?.numero}</h1>
        <p style={{ color: t.primary, fontSize: 14, margin: '8px 0 0' }}>En curso...</p>
        <p style={{ color: t.textGray, fontSize: 12, margin: '4px 0 0' }}>Inicio: {fmtH(rondaActiva?.hora_inicio)}</p>
      </div>

      <button onClick={() => finalizarRonda('ok')} disabled={loading} style={{ width: '100%', padding: 18, background: t.success, border: 'none', borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12, opacity: loading ? 0.5 : 1 }}>
        ✓ Finalizar - Todo OK
      </button>

      <button onClick={() => { const obs = prompt('Describe la novedad:'); if (obs) finalizarRonda('novedad', obs) }} disabled={loading} style={{ width: '100%', padding: 18, background: t.warning, border: 'none', borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12, opacity: loading ? 0.5 : 1 }}>
        ⚠️ Finalizar con Novedad
      </button>

      <button onClick={() => { const obs = prompt('Describe el incidente:'); if (obs) finalizarRonda('incidente', obs) }} disabled={loading} style={{ width: '100%', padding: 18, background: t.danger, border: 'none', borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
        🚨 Reportar Incidente
      </button>
    </div>
  )

  // REPORTE SCREEN
  if (screen === 'reporte') return (
    <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setScreen('home')} style={{ padding: 8, background: t.gray2, border: 'none', borderRadius: 6, color: t.textGray, cursor: 'pointer' }}>←</button>
        <h1 style={{ color: t.white, fontSize: 18, fontWeight: 700, margin: 0 }}>Nuevo Reporte</h1>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ color: t.textGray, fontSize: 12, marginBottom: 8 }}>Tipo de reporte:</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ id: 'novedad', label: 'Novedad', color: t.info }, { id: 'observacion', label: 'Observación', color: t.warning }, { id: 'urgente', label: 'Urgente', color: t.danger }].map(tipo => (
            <button key={tipo.id} onClick={() => setReporteTipo(tipo.id)} style={{ flex: 1, padding: 12, background: reporteTipo === tipo.id ? `${tipo.color}20` : t.gray, border: `2px solid ${reporteTipo === tipo.id ? tipo.color : t.gray2}`, borderRadius: 8, color: reporteTipo === tipo.id ? tipo.color : t.textGray, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {tipo.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ color: t.textGray, fontSize: 12, marginBottom: 8 }}>Descripción:</p>
        <textarea value={reporteTexto} onChange={e => setReporteTexto(e.target.value)} placeholder="Describe la situación..." style={{ width: '100%', height: 150, padding: 12, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 10, color: t.white, fontSize: 14, resize: 'none' }} />
      </div>

      <button onClick={enviarReporte} disabled={loading || !reporteTexto.trim()} style={{ width: '100%', padding: 16, background: t.primary, border: 'none', borderRadius: 10, color: t.white, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading || !reporteTexto.trim() ? 0.5 : 1 }}>
        Enviar Reporte
      </button>
    </div>
  )

  return null
}
