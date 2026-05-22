/**
 * Database initialization + schema
 * Creates all tables if they don't exist and seeds default superadmin
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

async function init() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('📦 Connected to MySQL, initializing database...');

    // Create database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'teamflow'}\``);
    await conn.query(`USE \`${process.env.DB_NAME || 'teamflow'}\``);

    // Users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT          PRIMARY KEY AUTO_INCREMENT,
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role          ENUM('superadmin', 'admin', 'member') DEFAULT 'member',
        created_at    TIMESTAMP    DEFAULT NOW(),
        updated_at    TIMESTAMP    DEFAULT NOW() ON UPDATE NOW()
      )
    `);
    console.log('  ✅ Table: users');

    // Projects table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id            INT          PRIMARY KEY AUTO_INCREMENT,
        name          VARCHAR(255) NOT NULL,
        description   TEXT         NULL,
        created_by_id INT          NULL,
        created_at    TIMESTAMP    DEFAULT NOW(),
        updated_at    TIMESTAMP    DEFAULT NOW() ON UPDATE NOW(),
        FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('  ✅ Table: projects');

    // Tasks table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id             INT          PRIMARY KEY AUTO_INCREMENT,
        title          VARCHAR(255) NOT NULL,
        description    TEXT         NULL,
        project_id     INT          NOT NULL,
        assignee_id    INT          NULL,
        assigned_by_id INT          NOT NULL,
        status         ENUM('To Do','In Progress','Done') DEFAULT 'To Do',
        priority       ENUM('Low','Medium','High')         DEFAULT 'Medium',
        due_date       DATE         NOT NULL,
        created_at     TIMESTAMP    DEFAULT NOW(),
        updated_at     TIMESTAMP    DEFAULT NOW() ON UPDATE NOW(),
        FOREIGN KEY (project_id)     REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id)    REFERENCES users(id)    ON DELETE SET NULL,
        FOREIGN KEY (assigned_by_id) REFERENCES users(id)    ON DELETE CASCADE
      )
    `);
    console.log('  ✅ Table: tasks');

    // Seed: check if superadmin exists
    const [existing] = await conn.query(`SELECT id FROM users WHERE role='superadmin' LIMIT 1`);
    if (existing.length === 0) {
      const hash = await bcrypt.hash('Admin@1234', 12);
      await conn.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)`,
        ['Super Admin', 'superadmin@teamflow.com', hash, 'superadmin']
      );
      console.log('  ✅ Default superadmin created: superadmin@teamflow.com / Admin@1234');
    } else {
      console.log('  ℹ️  Superadmin already exists, skipping seed');
    }

    // Seed some demo data if tables are empty
    const [usersCount] = await conn.query(`SELECT COUNT(*) as c FROM users`);
    if (usersCount[0].c < 3) {
      // Create demo admin
      const adminHash = await bcrypt.hash('Admin@1234', 12);
      await conn.query(
        `INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?,?,?,?)`,
        ['Arjun Mehta', 'admin@teamflow.com', adminHash, 'admin']
      );

      // Create demo members
      const memberHash = await bcrypt.hash('Member@1234', 12);
      await conn.query(
        `INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?,?,?,?)`,
        ['Priya Sharma', 'priya@teamflow.com', memberHash, 'member']
      );
      await conn.query(
        `INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?,?,?,?)`,
        ['Rahul Das', 'rahul@teamflow.com', memberHash, 'member']
      );
      console.log('  ✅ Demo users created (admin + 2 members)');

      // Get IDs
      const [[adminUser]] = await conn.query(`SELECT id FROM users WHERE email='admin@teamflow.com'`);
      const [[priya]] = await conn.query(`SELECT id FROM users WHERE email='priya@teamflow.com'`);
      const [[rahul]] = await conn.query(`SELECT id FROM users WHERE email='rahul@teamflow.com'`);

      // Create demo projects
      const [proj1] = await conn.query(
        `INSERT IGNORE INTO projects (name, description, created_by_id) VALUES (?,?,?)`,
        ['Website Redesign', 'Redesign the company website with modern UI', adminUser.id]
      );
      const [proj2] = await conn.query(
        `INSERT IGNORE INTO projects (name, description, created_by_id) VALUES (?,?,?)`,
        ['Mobile App', 'Build Android and iOS mobile application', adminUser.id]
      );
      console.log('  ✅ Demo projects created');

      const p1 = proj1.insertId;
      const p2 = proj2.insertId;

      if (p1 && p2) {
        // Create demo tasks
        const today = new Date();
        const future = new Date(); future.setDate(today.getDate() + 7);
        const past = new Date(); past.setDate(today.getDate() - 3);

        const fmt = (d) => d.toISOString().split('T')[0];

        await conn.query(
          `INSERT INTO tasks (title, description, project_id, assignee_id, assigned_by_id, status, priority, due_date)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['Design the login page', 'Include Google OAuth and forgot password link', p1, priya.id, adminUser.id, 'In Progress', 'High', fmt(future)]
        );
        await conn.query(
          `INSERT INTO tasks (title, description, project_id, assignee_id, assigned_by_id, status, priority, due_date)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['Setup navigation menu', 'Create responsive navbar with mobile hamburger', p1, rahul.id, adminUser.id, 'To Do', 'Medium', fmt(future)]
        );
        await conn.query(
          `INSERT INTO tasks (title, description, project_id, assignee_id, assigned_by_id, status, priority, due_date)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['Fix payment bug', 'Payment fails on iOS Safari — needs investigation', p2, priya.id, adminUser.id, 'To Do', 'High', fmt(past)]
        );
        await conn.query(
          `INSERT INTO tasks (title, description, project_id, assignee_id, assigned_by_id, status, priority, due_date)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['Write API documentation', 'Document all REST endpoints using Swagger', p2, rahul.id, adminUser.id, 'Done', 'Low', fmt(future)]
        );
        console.log('  ✅ Demo tasks created (4 tasks)');
      }
    }

    console.log('\n🚀 Database initialized successfully!');
    console.log('\n📋 Demo credentials:');
    console.log('  superadmin@teamflow.com / Admin@1234  (SuperAdmin)');
    console.log('  admin@teamflow.com      / Admin@1234  (Admin)');
    console.log('  priya@teamflow.com      / Member@1234 (Member)');
    console.log('  rahul@teamflow.com      / Member@1234 (Member)');

  } catch (err) {
    console.error('❌ Init failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

init();
