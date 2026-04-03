import { Hono } from 'hono'
import { verifyToken } from './auth'

type Bindings = { DB: D1Database }
const students = new Hono<{ Bindings: Bindings }>()

// Get student profile
students.get('/profile', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare(`
      SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?
    `).bind(payload.userId).first()

    if (!student) return c.json({ error: 'Профиль не найден' }, 404)
    return c.json(student)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Update student profile
students.put('/profile', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const body = await c.req.json()
    const { full_name, university, major, year, city, skills, languages, about, desired_field } = body

    await c.env.DB.prepare(`
      UPDATE students SET full_name=?, university=?, major=?, year=?, city=?, skills=?, languages=?, about=?, desired_field=?
      WHERE user_id=?
    `).bind(full_name, university, major, year, city, JSON.stringify(skills || []), JSON.stringify(languages || []), about, desired_field, payload.userId).run()

    // Recalculate readiness score
    let score = 0
    if (full_name) score += 10
    if (university) score += 10
    if (major) score += 5
    if (about && about.length > 50) score += 15
    if (skills && Array.isArray(skills) && skills.length > 0) score += Math.min(skills.length * 5, 20)
    if (languages && Array.isArray(languages) && languages.length > 0) score += 10

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    
    // Check resume
    const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE student_id = ?').bind(student?.id).first<any>()
    if (resume && resume.summary) score += 15
    
    // Check submissions
    const submissionsCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM submissions WHERE student_id = ?').bind(student?.id).first<any>()
    if (submissionsCount?.cnt > 0) score += Math.min(submissionsCount.cnt * 5, 15)

    await c.env.DB.prepare('UPDATE students SET readiness_score=? WHERE user_id=?').bind(Math.min(score, 100), payload.userId).run()

    return c.json({ message: 'Профиль обновлён', readiness_score: Math.min(score, 100) })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get student dashboard data
students.get('/dashboard', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    if (!student) return c.json({ error: 'Студент не найден' }, 404)

    const applications = await c.env.DB.prepare(`
      SELECT a.*, i.title, i.field, i.level, e.company_name, e.logo
      FROM applications a JOIN internships i ON a.internship_id = i.id JOIN employers e ON i.employer_id = e.id
      WHERE a.student_id = ? ORDER BY a.created_at DESC LIMIT 5
    `).bind(student.id).all()

    const savedInternships = await c.env.DB.prepare(`
      SELECT si.*, i.title, i.field, i.level, e.company_name, e.logo, i.format, i.city, i.is_paid
      FROM saved_internships si JOIN internships i ON si.internship_id = i.id JOIN employers e ON i.employer_id = e.id
      WHERE si.student_id = ? ORDER BY si.created_at DESC LIMIT 6
    `).bind(student.id).all()

    const submissions = await c.env.DB.prepare(`
      SELECT s.*, t.title as task_title, t.category, t.level as task_level
      FROM submissions s JOIN test_tasks t ON s.task_id = t.id
      WHERE s.student_id = ? ORDER BY s.created_at DESC LIMIT 5
    `).bind(student.id).all()

    const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE student_id = ?').bind(student.id).first()

    // Recommended internships by field
    let recommended: any[] = []
    if (student.desired_field) {
      const rec = await c.env.DB.prepare(`
        SELECT i.*, e.company_name, e.logo FROM internships i JOIN employers e ON i.employer_id = e.id
        WHERE i.field = ? AND i.is_active = 1 ORDER BY i.created_at DESC LIMIT 4
      `).bind(student.desired_field).all()
      recommended = rec.results
    }

    return c.json({
      student,
      applications: applications.results,
      savedInternships: savedInternships.results,
      submissions: submissions.results,
      resume,
      recommended
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get public student profile (portfolio)
students.get('/:id/portfolio', async (c) => {
  try {
    const id = c.req.param('id')
    const student = await c.env.DB.prepare(`
      SELECT s.id, s.full_name, s.university, s.major, s.year, s.city, s.skills, s.languages, s.about, s.desired_field, s.profile_photo, s.readiness_score
      FROM students s WHERE s.id = ?
    `).bind(id).first()

    if (!student) return c.json({ error: 'Студент не найден' }, 404)

    const submissions = await c.env.DB.prepare(`
      SELECT s.*, t.title as task_title, t.category
      FROM submissions s JOIN test_tasks t ON s.task_id = t.id
      WHERE s.student_id = ? AND s.status IN ('approved', 'reviewed') ORDER BY s.created_at DESC
    `).bind(id).all()

    const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE student_id = ?').bind(id).first()

    return c.json({ student, submissions: submissions.results, resume })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default students
