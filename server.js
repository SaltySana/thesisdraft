const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",     // your DB user
    password: "",     // your DB password
    database: "school_db" // your DB name
});

db.connect(err => {
    if (err) {
        console.error("Database connection failed:", err);
        return;
    }
    console.log("Connected to MySQL database.");
});

// ========== ROUTES ========== //

// Get all students
app.get("/api/students", (req, res) => {
    const sql = "SELECT id, first_name, middle_name, last_name FROM students";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

// Add new student
app.post("/api/students", (req, res) => {
    const { first_name, middle_name, last_name } = req.body;
    const sql = "INSERT INTO students (first_name, middle_name, last_name) VALUES (?, ?, ?)";
    db.query(sql, [first_name, middle_name, last_name], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ id: result.insertId, first_name, middle_name, last_name });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

async function addStudent(e) {
    e.preventDefault();

    const student = {
        first_name: document.getElementById("firstName").value,
        middle_name: document.getElementById("middleName").value,
        last_name: document.getElementById("lastName").value
    };

    try {
        await fetch("http://localhost:5000/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(student)
        });

        loadStudents(); // refresh the list
        closeModal();
    } catch (err) {
        console.error("Error adding student:", err);
    }
}