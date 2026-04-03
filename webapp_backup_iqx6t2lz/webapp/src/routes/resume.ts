import { Hono } from 'hono'
import { verifyToken } from './auth'

type Bindings = { DB: D1Database }
const resume = new Hono<{ Bindings: Bindings }>()

// Get resume
resume.get('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    if (!student) return c.json({ error: 'Студент не найден' }, 404)

    const res = await c.env.DB.prepare('SELECT * FROM resumes WHERE student_id = ?').bind(student.id).first()
    
    if (!res) {
      // Return empty template
      return c.json({
        student_id: student.id,
        summary: '',
        education: JSON.stringify([{ institution: student.university || '', degree: '', field: student.major || '', year_start: '', year_end: '' }]),
        experience: JSON.stringify([]),
        projects: JSON.stringify([]),
        skills: student.skills || '[]',
        languages: student.languages || '[]',
        certificates: JSON.stringify([]),
        achievements: ''
      })
    }
    return c.json(res)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Save/Update resume
resume.post('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    if (!student) return c.json({ error: 'Студент не найден' }, 404)

    const body = await c.req.json()
    const { summary, education, experience, projects, skills, languages, certificates, achievements, template } = body

    const existing = await c.env.DB.prepare('SELECT id FROM resumes WHERE student_id = ?').bind(student.id).first()

    if (existing) {
      await c.env.DB.prepare(`
        UPDATE resumes SET summary=?, education=?, experience=?, projects=?, skills=?, languages=?, certificates=?, achievements=?, template=?, updated_at=?
        WHERE student_id=?
      `).bind(
        summary || '',
        JSON.stringify(education || []),
        JSON.stringify(experience || []),
        JSON.stringify(projects || []),
        JSON.stringify(skills || []),
        JSON.stringify(languages || []),
        JSON.stringify(certificates || []),
        achievements || '',
        template || 'modern',
        new Date().toISOString(),
        student.id
      ).run()
    } else {
      await c.env.DB.prepare(`
        INSERT INTO resumes (student_id, summary, education, experience, projects, skills, languages, certificates, achievements, template)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        student.id,
        summary || '',
        JSON.stringify(education || []),
        JSON.stringify(experience || []),
        JSON.stringify(projects || []),
        JSON.stringify(skills || []),
        JSON.stringify(languages || []),
        JSON.stringify(certificates || []),
        achievements || '',
        template || 'modern'
      ).run()
    }

    // Update readiness score
    if (summary && summary.length > 50) {
      const currentScore = student.readiness_score || 0
      await c.env.DB.prepare('UPDATE students SET readiness_score=? WHERE id=?')
        .bind(Math.min(currentScore + 15, 100), student.id).run()
    }

    return c.json({ message: 'Резюме сохранено' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default resume
