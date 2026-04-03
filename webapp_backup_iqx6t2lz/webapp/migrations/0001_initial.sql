-- UniWay Database Schema

-- Users table (base for all user types)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- student, employer, admin
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  university TEXT,
  major TEXT,
  year INTEGER,
  city TEXT,
  skills TEXT, -- JSON array
  languages TEXT, -- JSON array
  about TEXT,
  profile_photo TEXT,
  desired_field TEXT,
  readiness_score INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Employers table
CREATE TABLE IF NOT EXISTS employers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  industry TEXT,
  contact_person TEXT,
  logo TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Internships/Vacancies table
CREATE TABLE IF NOT EXISTS internships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  format TEXT DEFAULT 'offline', -- offline, online, hybrid
  city TEXT,
  is_paid INTEGER DEFAULT 0, -- 0=false, 1=true
  salary TEXT,
  deadline TEXT,
  level TEXT DEFAULT 'intern', -- beginner, intern, junior
  skills TEXT, -- JSON array
  field TEXT,
  is_active INTEGER DEFAULT 1,
  views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employer_id) REFERENCES employers(id) ON DELETE CASCADE
);

-- Test Tasks table
CREATE TABLE IF NOT EXISTS test_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- frontend, backend, design, marketing, product, data, hr
  level TEXT NOT NULL DEFAULT 'easy', -- easy, medium, hard
  description TEXT,
  deadline_days INTEGER DEFAULT 3,
  expected_result TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Task Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  file_url TEXT,
  comment TEXT,
  status TEXT DEFAULT 'pending', -- pending, reviewed, approved, rejected
  score INTEGER,
  feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES test_tasks(id) ON DELETE CASCADE
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER UNIQUE NOT NULL,
  summary TEXT,
  education TEXT, -- JSON
  experience TEXT, -- JSON
  projects TEXT, -- JSON
  skills TEXT, -- JSON
  languages TEXT, -- JSON
  certificates TEXT, -- JSON
  achievements TEXT,
  template TEXT DEFAULT 'modern',
  file_url TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  internship_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, reviewed, interview, accepted, rejected
  cover_letter TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
);

-- Saved Internships table
CREATE TABLE IF NOT EXISTS saved_internships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  internship_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_employers_user_id ON employers(user_id);
CREATE INDEX IF NOT EXISTS idx_internships_employer ON internships(employer_id);
CREATE INDEX IF NOT EXISTS idx_internships_field ON internships(field);
CREATE INDEX IF NOT EXISTS idx_internships_level ON internships(level);
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_internship ON applications(internship_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
