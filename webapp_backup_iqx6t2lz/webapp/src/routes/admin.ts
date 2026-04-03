import { Hono } from 'hono'
import { verifyToken } from './auth'

type Bindings = { DB: D1Database }
const admin = new Hono<{ Bindings: Bindings }>()

// Middleware
admin.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
  const payload = await verifyToken(authHeader.replace('Bearer ', ''))
  if (!payload || payload.role !== 'admin') return c.json({ error: 'Доступ запрещён. Только для администраторов.' }, 403)
  await next()
})

// Stats
admin.get('/stats', async (c) => {
  try {
    const studentsCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM students').first<any>()
    const employersCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM employers').first<any>()
    const internshipsCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM internships WHERE is_active=1').first<any>()
    const applicationsCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM applications').first<any>()
    const tasksCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM test_tasks').first<any>()
    const submissionsCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM submissions').first<any>()

    return c.json({
      students: studentsCount?.cnt || 0,
      employers: employersCount?.cnt || 0,
      internships: internshipsCount?.cnt || 0,
      applications: applicationsCount?.cnt || 0,
      tasks: tasksCount?.cnt || 0,
      submissions: submissionsCount?.cnt || 0
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get all users
admin.get('/users', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC').all()
    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get all internships
admin.get('/internships', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT i.*, e.company_name FROM internships i JOIN employers e ON i.employer_id = e.id ORDER BY i.created_at DESC
    `).all()
    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Toggle internship active status
admin.patch('/internships/:id', async (c) => {
  try {
    const { is_active } = await c.req.json()
    await c.env.DB.prepare('UPDATE internships SET is_active=? WHERE id=?').bind(is_active ? 1 : 0, c.req.param('id')).run()
    return c.json({ message: 'Обновлено' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get all tasks
admin.get('/tasks', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM test_tasks ORDER BY created_at DESC').all()
    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Delete user
admin.delete('/users/:id', async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(c.req.param('id')).run()
    return c.json({ message: 'Пользователь удалён' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default admin
