import { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://ifcqzgwassoqtrefkinm.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmY3F6Z3dhc3NvcXRyZWZraW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDE3MTYsImV4cCI6MjA4MzkxNzcxNn0.8uOt18qIhf-r8q62e1WYTnL2rl6TxBozux3qDM90yiU'
const N8N_BASE = 'https://n8n-whatssapp-n8n.bdlk9h.easypanel.host/webhook'

const t = { primary: '#F97316', primaryDark: '#EA580C', dark: '#09090B', gray: '#18181B', gray2: '#27272A', gray3: '#3F3F46', white: '#FAFAFA', textGray: '#A1A1AA', success: '#22C55E', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6', purple: '#8B5CF6' }

async function supaQuery(table, options = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`
  if (options.filter) url += `${options.filter}&`
  if (options.order) url += `order=${options.order}&`
  if (options.limit) url += `limit=${options.limit}&`
  const res = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } })
  return res.json()
}

async function supaInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  })
  return res.json()
}

async function supaUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  })
  return res.json()
}

async function n8nWebhook(endpoint, data) {
  try {
    const res = await fetch(`${N8N_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  } catch (e) { console.error('n8n error:', e); return null }
}

const CHECKLIST_ITEMS = [
  { id: 1, texto: 'Puertas y accesos asegurados', critico: true },
  { id: 2, texto: 'Iluminación exterior funcionando', critico: false },
  { id: 3, texto: 'Cámaras de seguridad operativas', critico: true },
  { id: 4, texto: 'Alarmas sin novedades', critico: true },
  { id: 5, texto: 'Vehículos estacionados identificados', critico: false },
  { id: 6, texto: 'Perímetro sin daños visibles', critico: false },
  { id: 7, texto: 'Equipos de emergencia disponibles', critico: true },
  { id: 8, texto: 'Registro de visitas actualizado', critico: false },
  { id: 9, texto: 'Sin personas no autorizadas', critico: true },
  { id: 10, texto: 'Llaves y accesos completos', critico: true },
  { id: 11, texto: 'Radio/comunicación funcionando', critico: true }
]

const SECTORES = [
  { id: 1, nombre: 'Acceso Principal' },
  { id: 2, nombre: 'Estacionamiento' },
  { id: 3, nombre: 'Perímetro Norte' },
  { id: 4, nombre: 'Perímetro Sur' },
  { id: 5, nombre: 'Bodega / Almacén' },
  { id: 6, nombre: 'Oficinas' },
  { id: 7, nombre: 'Patio Central' },
  { id: 8, nombre: 'Acceso Secundario' },
  { id: 9, nombre: 'Sala de Máquinas' }
]

export default function App() {
  const [screen, setScreen] = useState('login')
  const [guardias, setGuardias] = useState([])
  const [instalaciones, setInstalaciones] = useState([])
  const [guardia, setGuardia] = useState(null)
  const [instalacion, setInstalacion] = useState(null)
  const [turno, setTurno] = useState(null)
  const [rondas, setRondas] = useState([])
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState(new Date())
  
  // Checkin state
  const [checklistStep, setChecklistStep] = useState(0)
  const [checklistResp, setChecklistResp] = useState({})
  const [checklistNota, setChecklistNota] = useState('')
  
  // Ronda state
  const [rondaInicio, setRondaInicio] = useState(null)
  const [sectorStep, setSectorStep] = useState(0)
  const [sectorResp, setSectorResp] = useState({})
  const [rondaNota, setRondaNota] = useState('')
  
  // Reporte state
  const [reporteTipo, setReporteTipo] = useState('novedad')
  const [reporteTexto, setReporteTexto] = useState('')
  const [reporteUbicacion, setReporteUbicacion] = useState('')
  
  // Emergencia state
  const [emergenciaTaps, setEmergenciaTaps] = useState(0)
  const [emergenciaTimer, setEmergenciaTimer] = useState(null)

  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i) }, [])
  useEffect(() => { loadInitial() }, [])

  const loadInitial = async () => {
    const [g, i] = await Promise.all([
      supaQuery('is_guardias', { filter: 'activo=eq.true' }),
      supaQuery('is_instalaciones', { filter: 'activo=eq.true' })
    ])
    setGuardias(g || [])
    setInstalaciones(i || [])
  }

  const fmt = d => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  const fmtFull = d => `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`
  const fmtDate = d => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  const today = () => new Date().toISOString().split('T')[0]
  const now = () => new Date().toTimeString().split(' ')[0].substring(0,5)
  const nowFull = () => new Date().toISOString()

  const doLogin = async (g) => {
    setGuardia(g)
    const turnos = await supaQuery('is_turnos', { filter: `guardia_id=eq.${g.id}&fecha=eq.${today()}&estado=eq.activo` })
    if (turnos && turnos.length > 0) {
      const t = turnos[0]
      setTurno(t)
      const inst = instalaciones.find(i => i.id === t.instalacion_id)
      setInstalacion(inst)
      const r = await supaQuery('is_rondas', { filter: `turno_id=eq.${t.id}`, order: 'numero.desc' })
      setRondas(r || [])
      setScreen('home')
    } else {
      setScreen('select_instalacion')
    }
  }

  const selectInstalacion = (inst) => {
    setInstalacion(inst)
    setChecklistStep(0)
    setChecklistResp({})
    setChecklistNota('')
    setScreen('checkin')
  }

  const responderChecklist = (resp) => {
    setChecklistResp({ ...checklistResp, [checklistStep]: resp })
    if (checklistStep < CHECKLIST_ITEMS.length - 1) {
      setChecklistStep(checklistStep + 1)
    } else {
      setScreen('checkin_nota')
    }
  }

  const finalizarCheckin = async () => {
    setLoading(true)
    const stats = { ok: 0, obs: 0, mal: 0, criticos: [], observaciones: [] }
    CHECKLIST_ITEMS.forEach((item, i) => {
      const r = checklistResp[i]
      if (r === 'ok') stats.ok++
      else if (r === 'obs') { stats.obs++; stats.observaciones.push(item.texto) }
      else if (r === 'mal') { stats.mal++; if (item.critico) stats.criticos.push(item.texto) }
    })

    const turnoData = {
      guardia_id: guardia.id,
      instalacion_id: instalacion.id,
      fecha: today(),
      turno_tipo: new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'diurno' : 'nocturno',
      estado: 'activo',
      checkin_timestamp: nowFull(),
      checkin_hora: now(),
      checkin_checklist: checklistResp,
      checkin_stats: stats,
      checkin_nota: checklistNota || null
    }

    const result = await supaInsert('is_turnos', turnoData)
    if (result && result[0]) {
      setTurno(result[0])
      
      // Notificar n8n
      await n8nWebhook('/checkin', {
        turno_id: result[0].id,
        guardia_id: guardia.id,
        guardia_nombre: `${guardia.nombre} ${guardia.apellido}`,
        guardia_rut: guardia.rut?.replace('-', ''),
        instalacion_id: instalacion.id,
        instalacion_codigo: instalacion.codigo,
        turno_tipo: turnoData.turno_tipo,
        hora: now(),
        timestamp: nowFull(),
        checklist: checklistResp,
        stats: stats,
        nota: checklistNota || null
      })

      setScreen('home')
    }
    setLoading(false)
  }

  const iniciarRonda = () => {
    setRondaInicio(new Date())
    setSectorStep(0)
    setSectorResp({})
    setRondaNota('')
    setScreen('ronda')
  }

  const responderSector = (resp) => {
    setSectorResp({ ...sectorResp, [sectorStep]: resp })
    if (sectorStep < SECTORES.length - 1) {
      setSectorStep(sectorStep + 1)
    } else {
      setScreen('ronda_nota')
    }
  }

  const finalizarRonda = async () => {
    setLoading(true)
    const fin = new Date()
    const duracion = Math.floor((fin - rondaInicio) / 1000)
    
    const stats = { ok: 0, obs: 0, mal: 0, sectoresOk: [], sectoresObs: [], sectoresMal: [] }
    SECTORES.forEach((s, i) => {
      const r = sectorResp[i]
      if (r === 'ok') { stats.ok++; stats.sectoresOk.push(s.nombre) }
      else if (r === 'obs') { stats.obs++; stats.sectoresObs.push(s.nombre) }
      else if (r === 'mal') { stats.mal++; stats.sectoresMal.push(s.nombre) }
    })

    const estado = stats.mal > 0 ? 'problemas' : stats.obs > 0 ? 'observaciones' : 'ok'
    const num = rondas.length + 1

    const rondaData = {
      turno_id: turno.id,
      numero: num,
      hora_inicio: rondaInicio.toTimeString().split(' ')[0].substring(0,5),
      hora_fin: now(),
      timestamp_inicio: rondaInicio.toISOString(),
      timestamp_fin: nowFull(),
      duracion_segundos: duracion,
      estado: estado,
      checklist: sectorResp,
      stats: stats,
      notas: rondaNota || null
    }

    const result = await supaInsert('is_rondas', rondaData)
    if (result && result[0]) {
      // Notificar n8n
      await n8nWebhook('/ronda', {
        turno_id: turno.id,
        guardia_nombre: `${guardia.nombre} ${guardia.apellido}`,
        instalacion_codigo: instalacion.codigo,
        numero: num,
        hora_inicio: rondaData.hora_inicio,
        hora_fin: rondaData.hora_fin,
        duracion_segundos: duracion,
        estado: estado,
        checklist: sectorResp,
        stats: stats,
        notas: rondaNota || null
      })

      const r = await supaQuery('is_rondas', { filter: `turno_id=eq.${turno.id}`, order: 'numero.desc' })
      setRondas(r || [])
    }
    
    setRondaInicio(null)
    setScreen('home')
    setLoading(false)
  }

  const enviarReporte = async () => {
    if (!reporteTexto.trim()) return
    setLoading(true)

    const reporteData = {
      turno_id: turno.id,
      tipo: reporteTipo,
      descripcion: reporteTexto,
      ubicacion: reporteUbicacion || null,
      hora: now(),
      timestamp: nowFull()
    }

    await supaInsert('is_reportes', reporteData)

    // Notificar n8n
    await n8nWebhook('/reporte', {
      turno_id: turno.id,
      guardia_nombre: `${guardia.nombre} ${guardia.apellido}`,
      instalacion_codigo: instalacion.codigo,
      tipo: reporteTipo,
      descripcion: reporteTexto,
      ubicacion: reporteUbicacion || null,
      hora: now(),
      timestamp: nowFull()
    })

    setReporteTexto('')
    setReporteUbicacion('')
    setReporteTipo('novedad')
    setScreen('home')
    setLoading(false)
  }

  const handleEmergencia = async () => {
    const newTaps = emergenciaTaps + 1
    setEmergenciaTaps(newTaps)

    if (emergenciaTimer) clearTimeout(emergenciaTimer)

    if (newTaps >= 3) {
      setEmergenciaTaps(0)
      setLoading(true)
      
      await supaInsert('is_alertas', {
        instalacion_id: instalacion.id,
        tipo: 'emergencia',
        titulo: `🚨 EMERGENCIA - ${instalacion.codigo}`,
        mensaje: `Alerta activada por ${guardia.nombre} ${guardia.apellido}`,
        prioridad: 'critica'
      })

      await n8nWebhook('/emergencia', {
        turno_id: turno.id,
        instalacion_id: instalacion.id,
        instalacion_codigo: instalacion.codigo,
        instalacion_direccion: instalacion.direccion,
        guardia_id: guardia.id,
        guardia_nombre: `${guardia.nombre} ${guardia.apellido}`,
        guardia_telefono: guardia.telefono,
        hora: now(),
        timestamp: nowFull()
      })

      setLoading(false)
      setScreen('emergencia_activa')
    } else {
      const timer = setTimeout(() => setEmergenciaTaps(0), 3000)
      setEmergenciaTimer(timer)
    }
  }

  const doCheckout = async () => {
    if (!confirm('¿Confirmar fin de turno?')) return
    setLoading(true)

    await supaUpdate('is_turnos', turno.id, {
      estado: 'finalizado',
      checkout_timestamp: nowFull(),
      checkout_hora: now()
    })

    await n8nWebhook('/checkout', {
      turno_id: turno.id,
      hora: now(),
      timestamp: nowFull()
    })

    setTurno(null)
    setInstalacion(null)
    setRondas([])
    setGuardia(null)
    setScreen('login')
    setLoading(false)
  }

  // ==================== SCREENS ====================

  // LOGIN
  if (screen === 'login') return (
    <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
      <div style={{ textAlign: 'center', marginTop: 60, marginBottom: 40 }}>
        <div style={{ width: 80, height: 80, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: `0 10px 40px ${t.primary}40` }}>
          <span style={{ fontSize: 36 }}>🛡️</span>
        </div>
        <h1 style={{ color: t.white, fontSize: 24, fontWeight: 700, margin: 0 }}>Inout Seguridad</h1>
        <p style={{ color: t.textGray, fontSize: 12, margin: '8px 0 0' }}>Sistema de Control de Guardias</p>
      </div>
      
      <p style={{ color: t.white, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Selecciona tu nombre:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {guardias.map(g => (
          <button key={g.id} onClick={() => doLogin(g)} style={{ padding: 18, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: `${t.primary}20`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18 }}>👤</span>
            </div>
            <div>
              <p style={{ margin: 0 }}>{g.nombre} {g.apellido}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: t.textGray }}>{g.cargo || 'Guardia'}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // SELECT INSTALACION
  if (screen === 'select_instalacion') return (
    <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: t.textGray, fontSize: 12, margin: 0 }}>Bienvenido</p>
        <h1 style={{ color: t.white, fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{guardia?.nombre} {guardia?.apellido}</h1>
      </div>
      
      <p style={{ color: t.white, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Selecciona instalación:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {instalaciones.map(i => (
          <button key={i.id} onClick={() => selectInstalacion(i)} style={{ padding: 16, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 12, color: t.white, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, background: `${t.info}20`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>🏢</span>
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{i.codigo}</p>
                <p style={{ fontSize: 11, color: t.textGray, margin: '2px 0 0' }}>{i.direccion}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <button onClick={() => { setGuardia(null); setScreen('login') }} style={{ marginTop: 24, padding: 14, background: 'transparent', border: `1px solid ${t.gray3}`, borderRadius: 10, color: t.textGray, width: '100%', cursor: 'pointer', fontSize: 13 }}>
        ← Volver
      </button>
    </div>
  )

  // CHECKIN - Checklist
  if (screen === 'checkin') {
    const item = CHECKLIST_ITEMS[checklistStep]
    const progress = ((checklistStep) / CHECKLIST_ITEMS.length) * 100
    return (
      <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: t.textGray, fontSize: 11, margin: 0 }}>Check-in → {instalacion?.codigo}</p>
          <h1 style={{ color: t.white, fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>Checklist de Ingreso</h1>
        </div>

        <div style={{ background: t.gray2, borderRadius: 8, height: 6, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ background: t.primary, height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>

        <div style={{ background: t.gray, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <p style={{ color: t.textGray, fontSize: 11, margin: '0 0 8px' }}>Punto {checklistStep + 1} de {CHECKLIST_ITEMS.length}</p>
          <p style={{ color: t.white, fontSize: 18, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{item.texto}</p>
          {item.critico && (
            <span style={{ display: 'inline-block', marginTop: 12, padding: '4px 10px', background: `${t.danger}20`, color: t.danger, borderRadius: 6, fontSize: 10, fontWeight: 600 }}>⚠️ PUNTO CRÍTICO</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => responderChecklist('ok')} style={{ padding: 18, background: `${t.success}15`, border: `2px solid ${t.success}`, borderRadius: 12, color: t.success, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            ✓ OK
          </button>
          <button onClick={() => responderChecklist('obs')} style={{ padding: 18, background: `${t.warning}15`, border: `2px solid ${t.warning}`, borderRadius: 12, color: t.warning, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            ⚠️ Observación
          </button>
          <button onClick={() => responderChecklist('mal')} style={{ padding: 18, background: `${t.danger}15`, border: `2px solid ${t.danger}`, borderRadius: 12, color: t.danger, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Problema
          </button>
        </div>

        {checklistStep > 0 && (
          <button onClick={() => setChecklistStep(checklistStep - 1)} style={{ marginTop: 16, padding: 12, background: 'transparent', border: 'none', color: t.textGray, width: '100%', cursor: 'pointer', fontSize: 13 }}>
            ← Anterior
          </button>
        )}
      </div>
    )
  }

  // CHECKIN - Nota final
  if (screen === 'checkin_nota') {
    const stats = { ok: 0, obs: 0, mal: 0 }
    Object.values(checklistResp).forEach(r => { if (r === 'ok') stats.ok++; else if (r === 'obs') stats.obs++; else if (r === 'mal') stats.mal++ })
    
    return (
      <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
        <h1 style={{ color: t.white, fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Resumen del Check-in</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          <div style={{ background: `${t.success}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.success, fontSize: 28, fontWeight: 700, margin: 0 }}>{stats.ok}</p>
            <p style={{ color: t.success, fontSize: 10, margin: 0 }}>OK</p>
          </div>
          <div style={{ background: `${t.warning}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.warning, fontSize: 28, fontWeight: 700, margin: 0 }}>{stats.obs}</p>
            <p style={{ color: t.warning, fontSize: 10, margin: 0 }}>OBS</p>
          </div>
          <div style={{ background: `${t.danger}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.danger, fontSize: 28, fontWeight: 700, margin: 0 }}>{stats.mal}</p>
            <p style={{ color: t.danger, fontSize: 10, margin: 0 }}>MAL</p>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ color: t.textGray, fontSize: 12, marginBottom: 8 }}>Nota adicional (opcional):</p>
          <textarea value={checklistNota} onChange={e => setChecklistNota(e.target.value)} placeholder="Alguna observación general..." style={{ width: '100%', height: 100, padding: 14, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 12, color: t.white, fontSize: 14, resize: 'none' }} />
        </div>

        <button onClick={finalizarCheckin} disabled={loading} style={{ width: '100%', padding: 18, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`, border: 'none', borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          {loading ? 'Procesando...' : '✓ Confirmar Check-in'}
        </button>
      </div>
    )
  }

  // HOME
  if (screen === 'home') return (
    <div style={{ minHeight: '100vh', background: t.dark, paddingBottom: 120 }}>
      <header style={{ background: `linear-gradient(135deg, ${t.gray}, ${t.gray2})`, padding: 20, borderBottom: `1px solid ${t.gray2}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: t.textGray, fontSize: 10, margin: 0 }}>En servicio</p>
            <h1 style={{ color: t.white, fontSize: 20, fontWeight: 700, margin: '2px 0 0' }}>{instalacion?.codigo}</h1>
            <p style={{ color: t.textGray, fontSize: 11, margin: '2px 0 0' }}>{instalacion?.direccion}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: t.white, fontSize: 24, fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>{fmt(time)}</p>
            <p style={{ color: t.textGray, fontSize: 10, margin: '2px 0 0' }}>{fmtDate(time)}</p>
          </div>
        </div>
        
        <div style={{ marginTop: 16, padding: 12, background: t.dark, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: `${t.primary}20`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>👤</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: t.white, fontSize: 13, fontWeight: 600, margin: 0 }}>{guardia?.nombre} {guardia?.apellido}</p>
            <p style={{ color: t.success, fontSize: 10, margin: '2px 0 0' }}>✓ Turno {turno?.turno_tipo} desde {turno?.checkin_hora?.substring(0,5)}</p>
          </div>
        </div>
      </header>

      <main style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: t.gray, borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <p style={{ color: t.purple, fontSize: 36, fontWeight: 700, margin: 0 }}>{rondas.length}</p>
            <p style={{ color: t.textGray, fontSize: 11, margin: '4px 0 0' }}>RONDAS</p>
          </div>
          <div style={{ background: t.gray, borderRadius: 16, padding: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 36, margin: 0 }}>{turno?.turno_tipo === 'diurno' ? '☀️' : '🌙'}</p>
            <p style={{ color: t.textGray, fontSize: 11, margin: '4px 0 0' }}>{turno?.turno_tipo?.toUpperCase()}</p>
          </div>
        </div>

        <button onClick={iniciarRonda} style={{ width: '100%', padding: 22, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`, border: 'none', borderRadius: 16, color: t.white, fontSize: 18, fontWeight: 700, cursor: 'pointer', marginBottom: 12, boxShadow: `0 8px 30px ${t.primary}40` }}>
          🚶 INICIAR RONDA
        </button>

        <button onClick={() => setScreen('reporte')} style={{ width: '100%', padding: 16, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 12, color: t.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
          📝 Enviar Reporte
        </button>

        <button onClick={handleEmergencia} style={{ width: '100%', padding: 16, background: `${t.danger}15`, border: `2px solid ${t.danger}`, borderRadius: 12, color: t.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 20 }}>
          🚨 EMERGENCIA {emergenciaTaps > 0 && `(${emergenciaTaps}/3)`}
        </button>

        {rondas.length > 0 && (
          <div>
            <h3 style={{ color: t.white, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Últimas rondas</h3>
            {rondas.slice(0, 5).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: t.gray, borderRadius: 10, marginBottom: 8 }}>
                <span style={{ color: t.white, fontSize: 13, fontWeight: 600 }}>Ronda #{r.numero}</span>
                <span style={{ color: t.textGray, fontSize: 11 }}>{r.hora_inicio?.substring(0,5)} - {r.hora_fin?.substring(0,5)}</span>
                <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 600, background: r.estado === 'ok' ? `${t.success}20` : r.estado === 'observaciones' ? `${t.warning}20` : `${t.danger}20`, color: r.estado === 'ok' ? t.success : r.estado === 'observaciones' ? t.warning : t.danger }}>
                  {r.estado?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: t.gray, borderTop: `1px solid ${t.gray2}`, padding: 16 }}>
        <button onClick={doCheckout} disabled={loading} style={{ width: '100%', padding: 14, background: t.gray2, border: 'none', borderRadius: 10, color: t.textGray, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Finalizar Turno (Check-out)
        </button>
      </footer>
    </div>
  )

  // RONDA - Sectores
  if (screen === 'ronda') {
    const sector = SECTORES[sectorStep]
    const progress = ((sectorStep) / SECTORES.length) * 100
    const elapsed = rondaInicio ? Math.floor((time - rondaInicio) / 1000) : 0
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    
    return (
      <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ color: t.textGray, fontSize: 11, margin: 0 }}>Ronda #{rondas.length + 1}</p>
            <h1 style={{ color: t.white, fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>Verificación</h1>
          </div>
          <div style={{ background: t.gray, padding: '8px 14px', borderRadius: 10 }}>
            <p style={{ color: t.primary, fontSize: 18, fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>
              {mins.toString().padStart(2,'0')}:{secs.toString().padStart(2,'0')}
            </p>
          </div>
        </div>

        <div style={{ background: t.gray2, borderRadius: 8, height: 6, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ background: t.primary, height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>

        <div style={{ background: t.gray, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <p style={{ color: t.textGray, fontSize: 11, margin: '0 0 8px' }}>Sector {sectorStep + 1} de {SECTORES.length}</p>
          <p style={{ color: t.white, fontSize: 20, fontWeight: 700, margin: 0 }}>{sector.nombre}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => responderSector('ok')} style={{ padding: 18, background: `${t.success}15`, border: `2px solid ${t.success}`, borderRadius: 12, color: t.success, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            ✓ OK
          </button>
          <button onClick={() => responderSector('obs')} style={{ padding: 18, background: `${t.warning}15`, border: `2px solid ${t.warning}`, borderRadius: 12, color: t.warning, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            ⚠️ Novedad
          </button>
          <button onClick={() => responderSector('mal')} style={{ padding: 18, background: `${t.danger}15`, border: `2px solid ${t.danger}`, borderRadius: 12, color: t.danger, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Problema
          </button>
        </div>

        {sectorStep > 0 && (
          <button onClick={() => setSectorStep(sectorStep - 1)} style={{ marginTop: 16, padding: 12, background: 'transparent', border: 'none', color: t.textGray, width: '100%', cursor: 'pointer', fontSize: 13 }}>
            ← Anterior
          </button>
        )}
      </div>
    )
  }

  // RONDA - Nota final
  if (screen === 'ronda_nota') {
    const stats = { ok: 0, obs: 0, mal: 0 }
    Object.values(sectorResp).forEach(r => { if (r === 'ok') stats.ok++; else if (r === 'obs') stats.obs++; else if (r === 'mal') stats.mal++ })
    
    return (
      <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
        <h1 style={{ color: t.white, fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Resumen de Ronda</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          <div style={{ background: `${t.success}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.success, fontSize: 28, fontWeight: 700, margin: 0 }}>{stats.ok}</p>
            <p style={{ color: t.success, fontSize: 10, margin: 0 }}>OK</p>
          </div>
          <div style={{ background: `${t.warning}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.warning, fontSize: 28, fontWeight: 700, margin: 0 }}>{stats.obs}</p>
            <p style={{ color: t.warning, fontSize: 10, margin: 0 }}>OBS</p>
          </div>
          <div style={{ background: `${t.danger}15`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <p style={{ color: t.danger, fontSize: 28, fontWeight: 700, margin: 0 }}>{stats.mal}</p>
            <p style={{ color: t.danger, fontSize: 10, margin: 0 }}>MAL</p>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ color: t.textGray, fontSize: 12, marginBottom: 8 }}>Nota adicional (opcional):</p>
          <textarea value={rondaNota} onChange={e => setRondaNota(e.target.value)} placeholder="Alguna observación de la ronda..." style={{ width: '100%', height: 100, padding: 14, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 12, color: t.white, fontSize: 14, resize: 'none' }} />
        </div>

        <button onClick={finalizarRonda} disabled={loading} style={{ width: '100%', padding: 18, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`, border: 'none', borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          {loading ? 'Guardando...' : '✓ Finalizar Ronda'}
        </button>
      </div>
    )
  }

  // REPORTE
  if (screen === 'reporte') return (
    <div style={{ minHeight: '100vh', background: t.dark, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setScreen('home')} style={{ width: 36, height: 36, background: t.gray2, border: 'none', borderRadius: 10, color: t.textGray, cursor: 'pointer', fontSize: 16 }}>←</button>
        <h1 style={{ color: t.white, fontSize: 18, fontWeight: 700, margin: 0 }}>Nuevo Reporte</h1>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ color: t.textGray, fontSize: 12, marginBottom: 10 }}>Tipo de reporte:</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'observacion', label: 'Observación', color: t.info },
            { id: 'novedad', label: 'Novedad', color: t.warning },
            { id: 'urgente', label: 'Urgente', color: t.danger }
          ].map(tipo => (
            <button key={tipo.id} onClick={() => setReporteTipo(tipo.id)} style={{ flex: 1, padding: 14, background: reporteTipo === tipo.id ? `${tipo.color}20` : t.gray, border: `2px solid ${reporteTipo === tipo.id ? tipo.color : t.gray2}`, borderRadius: 10, color: reporteTipo === tipo.id ? tipo.color : t.textGray, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {tipo.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ color: t.textGray, fontSize: 12, marginBottom: 8 }}>Ubicación (opcional):</p>
        <input value={reporteUbicacion} onChange={e => setReporteUbicacion(e.target.value)} placeholder="Ej: Sector Norte, Bodega 2..." style={{ width: '100%', padding: 14, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 10, color: t.white, fontSize: 14 }} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={{ color: t.textGray, fontSize: 12, marginBottom: 8 }}>Descripción:</p>
        <textarea value={reporteTexto} onChange={e => setReporteTexto(e.target.value)} placeholder="Describe la situación detalladamente..." style={{ width: '100%', height: 150, padding: 14, background: t.gray, border: `1px solid ${t.gray2}`, borderRadius: 12, color: t.white, fontSize: 14, resize: 'none' }} />
      </div>

      <button onClick={enviarReporte} disabled={loading || !reporteTexto.trim()} style={{ width: '100%', padding: 18, background: t.primary, border: 'none', borderRadius: 12, color: t.white, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading || !reporteTexto.trim() ? 0.5 : 1 }}>
        {loading ? 'Enviando...' : 'Enviar Reporte'}
      </button>
    </div>
  )

  // EMERGENCIA ACTIVA
  if (screen === 'emergencia_activa') return (
    <div style={{ minHeight: '100vh', background: t.danger, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ width: 100, height: 100, background: t.white, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, animation: 'pulse 1s infinite' }}>
        <span style={{ fontSize: 50 }}>🚨</span>
      </div>
      <h1 style={{ color: t.white, fontSize: 28, fontWeight: 700, margin: '0 0 12px' }}>EMERGENCIA ACTIVADA</h1>
      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 40 }}>Se ha notificado a la central de operaciones</p>
      
      <a href="tel:+56912345678" style={{ display: 'block', width: '100%', padding: 18, background: t.white, borderRadius: 12, color: t.danger, fontSize: 16, fontWeight: 700, textDecoration: 'none', marginBottom: 12 }}>
        📞 Llamar a Central
      </a>
      
      <button onClick={() => setScreen('home')} style={{ width: '100%', padding: 16, background: 'rgba(255,255,255,0.2)', border: '2px solid white', borderRadius: 12, color: t.white, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Volver al inicio
      </button>
      
      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
    </div>
  )

  return null
}
