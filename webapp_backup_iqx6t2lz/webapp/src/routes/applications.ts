import { Hono } from 'hono'
import { verifyToken } from './auth'

type Bindings = { DB: D1Database }
const applications = new Hono<{ Bindings: Bindings }>()

// Apply for internship
applications.post('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    if (!student) return c.json({ error: 'Студент не найден' }, 404)

    const { internship_id, cover_letter } = await c.req.json()

    // Check duplicate
    const existing = await c.env.DB.prepare('SELECT id FROM applications WHERE student_id=? AND internship_id=?').bind(student.id, internship_id).first()
    if (existing) return c.json({ error: 'Вы уже откликались на эту стажировку' }, 400)

    await c.env.DB.prepare('INSERT INTO applications (student_id, internship_id, cover_letter) VALUES (?, ?, ?)')
      .bind(student.id, internship_id, cover_letter || '').run()

    return c.json({ message: 'Отклик отправлен!' }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get student's applications
applications.get('/my', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    const result = await c.env.DB.prepare(`
      SELECT a.*, i.title, i.field, i.level, i.format, i.city, e.company_name, e.logo
      FROM applications a JOIN internships i ON a.internship_id = i.id JOIN employers e ON i.employer_id = e.id
      WHERE a.student_id = ? ORDER BY a.created_at DESC
    `).bind(student?.id).all()

    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get employer's applications for their internships
applications.get('/employer', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'employer') return c.json({ error: 'Доступ запрещён' }, 403)

    const employer = await c.env.DB.prepare('SELECT * FROM employers WHERE user_id = ?').bind(payload.userId).first<any>()
    const result = await c.env.DB.prepare(`
      SELECT a.*, i.title as internship_title, s.full_name, s.university, s.major, s.year, s.skills, s.readiness_score, s.id as student_id
      FROM applications a 
      JOIN internships i ON a.internship_id = i.id 
      JOIN students s ON a.student_id = s.id
      WHERE i.employer_id = ? ORDER BY a.created_at DESC
    `).bind(employer?.id).all()

    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Update application status (employer)
applications.patch('/:id/status', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'employer') return c.json({ error: 'Доступ запрещён' }, 403)

    const { status } = await c.req.json()
    await c.env.DB.prepare('UPDATE applications SET status=? WHERE id=?').bind(status, c.req.param('id')).run()
    return c.json({ message: 'Статус обновлён' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default applications
