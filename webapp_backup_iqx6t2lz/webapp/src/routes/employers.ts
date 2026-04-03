import { Hono } from 'hono'
import { verifyToken } from './auth'

type Bindings = { DB: D1Database }
const employers = new Hono<{ Bindings: Bindings }>()

// Get employer profile
employers.get('/profile', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'employer') return c.json({ error: 'Доступ запрещён' }, 403)

    const employer = await c.env.DB.prepare(`
      SELECT e.*, u.email FROM employers e JOIN users u ON e.user_id = u.id WHERE e.user_id = ?
    `).bind(payload.userId).first()

    if (!employer) return c.json({ error: 'Профиль не найден' }, 404)
    return c.json(employer)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Update employer profile
employers.put('/profile', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'employer') return c.json({ error: 'Доступ запрещён' }, 403)

    const body = await c.req.json()
    const { company_name, description, website, industry, contact_person } = body

    await c.env.DB.prepare(`
      UPDATE employers SET company_name=?, description=?, website=?, industry=?, contact_person=? WHERE user_id=?
    `).bind(company_name, description, website, industry, contact_person, payload.userId).run()

    return c.json({ message: 'Профиль обновлён' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get employer's internships
employers.get('/internships', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'employer') return c.json({ error: 'Доступ запрещён' }, 403)

    const employer = await c.env.DB.prepare('SELECT * FROM employers WHERE user_id = ?').bind(payload.userId).first<any>()
    
    const result = await c.env.DB.prepare(`
      SELECT i.*, COUNT(a.id) as applications_count
      FROM internships i LEFT JOIN applications a ON i.id = a.internship_id
      WHERE i.employer_id = ? GROUP BY i.id ORDER BY i.created_at DESC
    `).bind(employer?.id).all()

    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get student portfolio for employer
employers.get('/students/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || (payload.role !== 'employer' && payload.role !== 'admin')) return c.json({ error: 'Доступ запрещён' }, 403)

    const id = c.req.param('id')
    const student = await c.env.DB.prepare(`
      SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?
    `).bind(id).first()

    if (!student) return c.json({ error: 'Студент не найден' }, 404)

    const submissions = await c.env.DB.prepare(`
      SELECT s.*, t.title as task_title, t.category, t.level as task_level
      FROM submissions s JOIN test_tasks t ON s.task_id = t.id WHERE s.student_id = ? ORDER BY s.created_at DESC
    `).bind(id).all()

    const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE student_id = ?').bind(id).first()

    return c.json({ student, submissions: submissions.results, resume })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default employers
