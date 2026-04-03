import { Hono } from 'hono'

type Bindings = { DB: D1Database; JWT_SECRET: string }
const auth = new Hono<{ Bindings: Bindings }>()

// Simple hash function (for demo - in production use bcrypt)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'uniway_salt_2024')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function generateToken(userId: number, role: string): Promise<string> {
  const payload = { userId, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(payload))
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return btoa(JSON.stringify(payload)) + '.' + hashHex
}

export async function verifyToken(token: string): Promise<{ userId: number; role: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(atob(parts[0]))
    if (payload.exp < Date.now()) return null
    return { userId: payload.userId, role: payload.role }
  } catch {
    return null
  }
}

// Register student
auth.post('/register/student', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, full_name, university, major, year, city, skills, languages, desired_field } = body

    if (!email || !password || !full_name) {
      return c.json({ error: 'Email, пароль и имя обязательны' }, 400)
    }

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      return c.json({ error: 'Пользователь с таким email уже существует' }, 400)
    }

    const passwordHash = await hashPassword(password)

    const userResult = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?) RETURNING id'
    ).bind(email, passwordHash, 'student').first<{ id: number }>()

    if (!userResult) return c.json({ error: 'Ошибка создания пользователя' }, 500)

    await c.env.DB.prepare(
      'INSERT INTO students (user_id, full_name, university, major, year, city, skills, languages, desired_field) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      userResult.id, full_name, university || '', major || '', year || 1, city || '',
      JSON.stringify(skills || []), JSON.stringify(languages || []), desired_field || ''
    ).run()

    const token = await generateToken(userResult.id, 'student')

    const student = await c.env.DB.prepare(`
      SELECT s.*, u.email, u.role FROM students s 
      JOIN users u ON s.user_id = u.id WHERE s.user_id = ?
    `).bind(userResult.id).first()

    return c.json({ token, user: student, role: 'student' })
  } catch (e: any) {
    return c.json({ error: 'Ошибка сервера: ' + e.message }, 500)
  }
})

// Register employer
auth.post('/register/employer', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, company_name, description, website, industry, contact_person } = body

    if (!email || !password || !company_name) {
      return c.json({ error: 'Email, пароль и название компании обязательны' }, 400)
    }

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) return c.json({ error: 'Пользователь с таким email уже существует' }, 400)

    const passwordHash = await hashPassword(password)

    const userResult = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?) RETURNING id'
    ).bind(email, passwordHash, 'employer').first<{ id: number }>()

    if (!userResult) return c.json({ error: 'Ошибка создания пользователя' }, 500)

    await c.env.DB.prepare(
      'INSERT INTO employers (user_id, company_name, description, website, industry, contact_person) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userResult.id, company_name, description || '', website || '', industry || '', contact_person || '').run()

    const token = await generateToken(userResult.id, 'employer')

    const employer = await c.env.DB.prepare(`
      SELECT e.*, u.email, u.role FROM employers e 
      JOIN users u ON e.user_id = u.id WHERE e.user_id = ?
    `).bind(userResult.id).first()

    return c.json({ token, user: employer, role: 'employer' })
  } catch (e: any) {
    return c.json({ error: 'Ошибка сервера: ' + e.message }, 500)
  }
})

// Login
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Email и пароль обязательны' }, 400)

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<any>()
    if (!user) return c.json({ error: 'Неверный email или пароль' }, 401)

    const passwordHash = await hashPassword(password)
    if (user.password_hash !== passwordHash) return c.json({ error: 'Неверный email или пароль' }, 401)

    const token = await generateToken(user.id, user.role)

    let profile = null
    if (user.role === 'student') {
      profile = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(user.id).first()
    } else if (user.role === 'employer') {
      profile = await c.env.DB.prepare('SELECT * FROM employers WHERE user_id = ?').bind(user.id).first()
    }

    return c.json({ token, user: { ...profile, email: user.email, role: user.role }, role: user.role })
  } catch (e: any) {
    return c.json({ error: 'Ошибка сервера: ' + e.message }, 500)
  }
})

// Get current user
auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const payload = await verifyToken(token)
    if (!payload) return c.json({ error: 'Невалидный токен' }, 401)

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first<any>()
    if (!user) return c.json({ error: 'Пользователь не найден' }, 404)

    let profile = null
    if (user.role === 'student') {
      profile = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(user.id).first()
    } else if (user.role === 'employer') {
      profile = await c.env.DB.prepare('SELECT * FROM employers WHERE user_id = ?').bind(user.id).first()
    }

    return c.json({ user: { ...profile, email: user.email, role: user.role, userId: user.id }, role: user.role })
  } catch (e: any) {
    return c.json({ error: 'Ошибка сервера: ' + e.message }, 500)
  }
})

export default auth
