import { Hono } from 'hono'
import { verifyToken } from './auth'

type Bindings = { DB: D1Database }
const internships = new Hono<{ Bindings: Bindings }>()

// Get all internships with filters
internships.get('/', async (c) => {
  try {
    const { field, level, format, city, is_paid, search, page = '1', limit = '12' } = c.req.query()
    let query = `
      SELECT i.*, e.company_name, e.logo, e.industry 
      FROM internships i 
      JOIN employers e ON i.employer_id = e.id 
      WHERE i.is_active = 1
    `
    const params: any[] = []

    if (field) { query += ' AND i.field = ?'; params.push(field) }
    if (level) { query += ' AND i.level = ?'; params.push(level) }
    if (format) { query += ' AND i.format = ?'; params.push(format) }
    if (city) { query += ' AND i.city LIKE ?'; params.push(`%${city}%`) }
    if (is_paid !== undefined && is_paid !== '') { query += ' AND i.is_paid = ?'; params.push(is_paid === 'true' ? 1 : 0) }
    if (search) { query += ' AND (i.title LIKE ? OR e.company_name LIKE ? OR i.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }

    query += ' ORDER BY i.created_at DESC'

    const offset = (parseInt(page) - 1) * parseInt(limit)
    query += ` LIMIT ? OFFSET ?`
    params.push(parseInt(limit), offset)

    const result = await c.env.DB.prepare(query).bind(...params).all()
    
    // Count total
    let countQuery = 'SELECT COUNT(*) as total FROM internships i JOIN employers e ON i.employer_id = e.id WHERE i.is_active = 1'
    const countParams: any[] = []
    if (field) { countQuery += ' AND i.field = ?'; countParams.push(field) }
    if (level) { countQuery += ' AND i.level = ?'; countParams.push(level) }
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>()

    return c.json({ internships: result.results, total: countResult?.total || 0 })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get single internship
internships.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const internship = await c.env.DB.prepare(`
      SELECT i.*, e.company_name, e.logo, e.industry, e.description as company_description, e.website
      FROM internships i JOIN employers e ON i.employer_id = e.id WHERE i.id = ?
    `).bind(id).first()
    
    if (!internship) return c.json({ error: 'Стажировка не найдена' }, 404)
    
    // Increment views
    await c.env.DB.prepare('UPDATE internships SET views = views + 1 WHERE id = ?').bind(id).run()
    
    return c.json(internship)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Create internship (employer only)
internships.post('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'employer') return c.json({ error: 'Доступ запрещён' }, 403)

    const employer = await c.env.DB.prepare('SELECT * FROM employers WHERE user_id = ?').bind(payload.userId).first<any>()
    if (!employer) return c.json({ error: 'Работодатель не найден' }, 404)

    const body = await c.req.json()
    const { title, description, requirements, responsibilities, format, city, is_paid, salary, deadline, level, skills, field } = body

    if (!title) return c.json({ error: 'Название обязательно' }, 400)

    const result = await c.env.DB.prepare(`
      INSERT INTO internships (employer_id, title, description, requirements, responsibilities, format, city, is_paid, salary, deadline, level, skills, field)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `).bind(
      employer.id, title, description || '', requirements || '', responsibilities || '',
      format || 'offline', city || '', is_paid ? 1 : 0, salary || '', deadline || '',
      level || 'intern', JSON.stringify(skills || []), field || ''
    ).first<{ id: number }>()

    return c.json({ id: result?.id, message: 'Стажировка создана' }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Update internship
internships.put('/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'employer') return c.json({ error: 'Доступ запрещён' }, 403)

    const employer = await c.env.DB.prepare('SELECT * FROM employers WHERE user_id = ?').bind(payload.userId).first<any>()
    const id = c.req.param('id')
    const body = await c.req.json()

    const { title, description, requirements, responsibilities, format, city, is_paid, salary, deadline, level, skills, field, is_active } = body

    await c.env.DB.prepare(`
      UPDATE internships SET title=?, description=?, requirements=?, responsibilities=?, format=?, city=?, is_paid=?, salary=?, deadline=?, level=?, skills=?, field=?, is_active=?
      WHERE id=? AND employer_id=?
    `).bind(title, description, requirements, responsibilities, format, city, is_paid ? 1 : 0, salary, deadline, level, JSON.stringify(skills || []), field, is_active ? 1 : 0, id, employer?.id).run()

    return c.json({ message: 'Обновлено' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Delete internship
internships.delete('/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || (payload.role !== 'employer' && payload.role !== 'admin')) return c.json({ error: 'Доступ запрещён' }, 403)

    const id = c.req.param('id')
    await c.env.DB.prepare('UPDATE internships SET is_active=0 WHERE id=?').bind(id).run()
    return c.json({ message: 'Стажировка удалена' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Save/Unsave internship
internships.post('/:id/save', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    const id = c.req.param('id')

    const existing = await c.env.DB.prepare('SELECT id FROM saved_internships WHERE student_id=? AND internship_id=?').bind(student?.id, id).first()
    if (existing) {
      await c.env.DB.prepare('DELETE FROM saved_internships WHERE student_id=? AND internship_id=?').bind(student?.id, id).run()
      return c.json({ saved: false })
    } else {
      await c.env.DB.prepare('INSERT INTO saved_internships (student_id, internship_id) VALUES (?, ?)').bind(student?.id, id).run()
      return c.json({ saved: true })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default internships
