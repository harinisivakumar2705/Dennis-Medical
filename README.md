<!DOCTYPE html>
<div align="center">
</div>
<html lang="en">
<body>

  <h1>Dennis Medical – Clinic Management System</h1>

  <h2>Overview</h2>
  <p>
    Dennis Medical is a web-based clinic management system designed to simulate a real-world outpatient
    healthcare workflow. It demonstrates how modern frontend development can be combined with Firebase
    services to manage patients, appointments, and staff access in a structured and scalable way.
  </p>

  <p>
    The project focuses on clear data flow between authentication, user roles, and clinical operations,
    with an emphasis on simplicity, usability, and maintainable architecture.
  </p>

  <h2>Key Objectives</h2>
  <ul>
    <li>Build a practical React application with real-world structure</li>
    <li>Implement authentication using Firebase</li>
    <li>Demonstrate basic role-based access control (RBAC)</li>
    <li>Use Firestore for real-time data management</li>
    <li>Maintain a modular, component-based architecture</li>
    <li>Simulate production-style frontend development practices</li>
  </ul>

  <h2>Core Features</h2>

  <h3>Authentication System</h3>
  <ul>
    <li>Google Sign-In via Firebase Authentication</li>
    <li>Persistent user sessions</li>
    <li>User profiles stored in Firestore</li>
    <li>Basic role assignment (admin / staff)</li>
  </ul>

  <h3>Patient Management</h3>
  <ul>
    <li>View and manage patient records</li>
    <li>Track patient status (waiting, discharged, etc.)</li>
    <li>Link patients to appointments and workflows</li>
  </ul>

  <h3>Appointment Scheduling</h3>
  <ul>
    <li>Weekly calendar-based scheduling system</li>
    <li>Create, update, and delete appointments</li>
    <li>Status tracking (scheduled, checked in, completed, cancelled)</li>
    <li>Toggle between calendar and list views</li>
  </ul>

  <h3>Role-Based Access Control (Simplified)</h3>
  <ul>
    <li>Admin and staff roles</li>
    <li>Feature visibility based on permissions</li>
    <li>Lightweight RBAC model for learning purposes</li>
  </ul>

  <h3>Audit Logging (Basic Implementation)</h3>
  <ul>
    <li>Logs key system actions (login, create, update, delete)</li>
    <li>Simulates compliance-style tracking</li>
  </ul>

  <h2>Technologies Used</h2>

  <h3>Frontend</h3>
  <ul>
    <li>React</li>
    <li>TypeScript</li>
    <li>React Router DOM</li>
    <li>Tailwind CSS</li>
  </ul>

  <h3>Backend / Services</h3>
  <ul>
    <li>Firebase Authentication</li>
    <li>Firestore Database</li>
  </ul>

  <h3>UI & Utilities</h3>
  <ul>
    <li>Lucide React (icons)</li>
    <li>Framer Motion (animations)</li>
    <li>date-fns (date handling)</li>
  </ul>

  <h2>Project Structure</h2>
  <pre>
src/
  components/   Reusable UI components
  context/      Authentication and global state
  pages/        Route-based pages
  services/     Firebase + audit logic
  lib/          Utility functions
  types/        TypeScript types
  </pre>

  <h2>What I Learned</h2>
  <ul>
    <li>React component architecture and state management</li>
    <li>Authentication flows using Firebase</li>
    <li>Firestore CRUD operations and real-time updates</li>
    <li>Structuring medium-to-large React applications</li>
    <li>Balancing simplicity with scalable design</li>
  </ul>

  <h2>Notes</h2>
  <p>
    This project is a learning-focused implementation of a clinic management system.
    Some features (such as RBAC and audit logging) are simplified to prioritise clarity,
    readability, and maintainability.
  </p>

</body>
</html>
