# DigiGate Web

A comprehensive web-based entry/exit management system designed for college campuses. DigiGate streamlines student attendance and movement logging at gates and hostels using QR code technology and role-based access control.

## 🚀 Features

### 🎓 Student Portal
- **Dashboard:** View personal entry/exit logs and history.
- **QR Code Generation:** Generate unique QR codes for seamless entry/exit scanning.
- **Profile Management:** View student details and hostel information.

### 🛡️ Guard Interface
- **Scanner & Manual Entry:** Scan student QR codes or manually log entry/exit events.
- **Live Feed:** Real-time view of recent logs at the assigned location.
- **Location Management:** Update current guard station/location.

### 🔑 Admin Dashboard
- **User Management:** Full CRUD (Create, Read, Update, Delete) operations for Students, Guards, and Admins.
- **Location Management:** Manage campus locations (Gates, Hostels, etc.).
- **Log Monitoring:** View and manage all entry/exit logs across the campus.
- **Statistics:** Real-time stats on student and guard counts.

## 🛠️ Tech Stack

**Frontend:**
- **Framework:** [React](https://react.dev/) (v19)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Routing:** [React Router](https://reactrouter.com/) (v7)
- **Styling:** CSS
- **QR Utilities:** `html5-qrcode`, `qrcode`

**Backend:**
- **Runtime:** [Node.js](https://nodejs.org/)
- **Framework:** [Express.js](https://expressjs.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **Authentication:** Session-based (`express-session`, `cookie-parser`)
- **Security:** `bcrypt` (password hashing), `cors`

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/)

## 📥 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/abhay-006/Digigate-web.git
cd Digigate-web
```

### 2. Frontend Setup
Navigate to the root directory and install dependencies:
```bash
npm install
```

### 3. Backend Setup
Navigate to the `Backend` directory and install dependencies:
```bash
cd Backend
npm install
```

## 🗄️ Database Setup

1.  Create a PostgreSQL database.
2.  Use the `Backend/schema.sql` file to create the necessary tables.
    ```bash
    psql -U your_username -d your_database_name -f Backend/schema.sql
    ```

## 🔐 Configuration

Create a `.env` file in the `Backend` directory with the following variables:

```env
# Database Configuration

host=localhost
DB_PORT=5432
database=your_database_name
user=your_db_username
password=your_db_password

# Server Configuration

PORT=3000
Frontend_URL=http://localhost:5173 
NODE_ENV=development
```

> **Note:** Update `Frontend_URL` if your frontend runs on a different port.

## 🏃‍♂️ Running the Application

### Start the Backend
Open a terminal, navigate to the `Backend` folder, and run:
```bash
node server.js
```
The server will start on `http://localhost:3000`.

### Start the Frontend
Open a new terminal, navigate to the project root, and run:
```bash
npm run dev
```
The React app will likely start on `http://localhost:5173`.

## 📖 Usage Guide

1.  **Admin Login:** Log in as an admin to populate the database with Students, Guards, and Locations.
2.  **Student Login:** Students use their `Roll No` and `Password` to access their dashboard and QR code.
3.  **Guard Login:** Guards use their `Guard ID` and `Password` to access the scanning interface.

## 📄 License

This project is licensed under the ISC License.
