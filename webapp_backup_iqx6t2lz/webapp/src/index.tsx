import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import authRoutes from './routes/auth'
import studentRoutes from './routes/students'
import employerRoutes from './routes/employers'
import internshipRoutes from './routes/internships'
import taskRoutes from './routes/tasks'
import resumeRoutes from './routes/resume'
import adminRoutes from './routes/admin'
import applicationRoutes from './routes/applications'
import indexHtml from 'virtual:index-html'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// API Routes
app.route('/api/auth', authRoutes)
app.route('/api/students', studentRoutes)
app.route('/api/employers', employerRoutes)
app.route('/api/internships', internshipRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api/resume', resumeRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/applications', applicationRoutes)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// SPA - serve index.html for all non-API routes
app.get('*', (c) => {
  return c.html(indexHtml as string)
})

export default app
