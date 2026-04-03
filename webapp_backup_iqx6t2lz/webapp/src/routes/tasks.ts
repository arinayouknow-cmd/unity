import { Hono } from 'hono'
import { verifyToken } from './auth'

type Bindings = { DB: D1Database }
const tasks = new Hono<{ Bindings: Bindings }>()

// Get all tasks with filters
tasks.get('/', async (c) => {
  try {
    const { category, level, search } = c.req.query()
    let query = 'SELECT * FROM test_tasks WHERE is_active = 1'
    const params: any[] = []

    if (category) { query += ' AND category = ?'; params.push(category) }
    if (level) { query += ' AND level = ?'; params.push(level) }
    if (search) { query += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }

    query += ' ORDER BY created_at DESC'
    const result = await c.env.DB.prepare(query).bind(...params).all()
    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get single task
tasks.get('/:id', async (c) => {
  try {
    const task = await c.env.DB.prepare('SELECT * FROM test_tasks WHERE id = ? AND is_active = 1').bind(c.req.param('id')).first()
    if (!task) return c.json({ error: 'Задание не найдено' }, 404)
    return c.json(task)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Submit task solution
tasks.post('/:id/submit', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    if (!student) return c.json({ error: 'Студент не найден' }, 404)

    const taskId = c.req.param('id')
    const task = await c.env.DB.prepare('SELECT * FROM test_tasks WHERE id = ?').bind(taskId).first<any>()
    if (!task) return c.json({ error: 'Задание не найдено' }, 404)

    const body = await c.req.json()
    const { comment, file_url } = body

    // Check for existing submission
    const existing = await c.env.DB.prepare('SELECT id FROM submissions WHERE student_id=? AND task_id=?').bind(student.id, taskId).first()
    
    let submissionId
    if (existing) {
      await c.env.DB.prepare('UPDATE submissions SET comment=?, file_url=?, status=?, created_at=? WHERE student_id=? AND task_id=?')
        .bind(comment || '', file_url || '', 'pending', new Date().toISOString(), student.id, taskId).run()
      submissionId = (existing as any).id
    } else {
      const result = await c.env.DB.prepare('INSERT INTO submissions (student_id, task_id, comment, file_url, status) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .bind(student.id, taskId, comment || '', file_url || '', 'pending').first<{ id: number }>()
      submissionId = result?.id
    }

    // Auto-review with basic feedback
    const feedbackMap: Record<string, string> = {
      'frontend': 'Хорошая работа! Обратите внимание на адаптивность и кроссбраузерность.',
      'backend': 'Отличное начало! Для улучшения добавьте обработку ошибок и документацию.',
      'design': 'Интересный подход к дизайну! Работайте над консистентностью стиля.',
      'marketing': 'Хороший анализ! Добавьте больше конкретных метрик и KPI.',
      'product': 'Отличное понимание продукта! Уточните приоритизацию задач.',
      'data': 'Хорошие инсайты! Добавьте больше визуализаций.',
      'hr': 'Хороший подход! Уточните критерии оценки кандидатов.'
    }

    const feedback = feedbackMap[task.category] || 'Задание выполнено. Продолжайте практиковаться!'
    const score = Math.floor(Math.random() * 20) + 75 // 75-95

    await c.env.DB.prepare('UPDATE submissions SET status=?, score=?, feedback=? WHERE id=?')
      .bind('reviewed', score, feedback, submissionId).run()

    // Update readiness score
    const submissionsCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM submissions WHERE student_id = ?').bind(student.id).first<any>()
    const newScore = Math.min(student.readiness_score + 5, 100)
    await c.env.DB.prepare('UPDATE students SET readiness_score=? WHERE id=?').bind(newScore, student.id).run()

    return c.json({ message: 'Решение отправлено!', score, feedback })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Get student's submissions
tasks.get('/my/submissions', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'student') return c.json({ error: 'Доступ запрещён' }, 403)

    const student = await c.env.DB.prepare('SELECT * FROM students WHERE user_id = ?').bind(payload.userId).first<any>()
    const result = await c.env.DB.prepare(`
      SELECT s.*, t.title as task_title, t.category, t.level as task_level, t.description as task_description
      FROM submissions s JOIN test_tasks t ON s.task_id = t.id WHERE s.student_id = ? ORDER BY s.created_at DESC
    `).bind(student?.id).all()

    return c.json(result.results)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Create task (admin only)
tasks.post('/', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Не авторизован' }, 401)
    const payload = await verifyToken(authHeader.replace('Bearer ', ''))
    if (!payload || payload.role !== 'admin') return c.json({ error: 'Доступ запрещён' }, 403)

    const body = await c.req.json()
    const { title, category, level, description, deadline_days, expected_result } = body

    await c.env.DB.prepare('INSERT INTO test_tasks (title, category, level, description, deadline_days, expected_result) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(title, category, level, description, deadline_days || 3, expected_result).run()

    return c.json({ message: 'Задание создано' }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default tasks
