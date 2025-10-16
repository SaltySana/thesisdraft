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

// Get all students (summary)
app.get("/api/students", (req, res) => {
    const sql = "SELECT id, first_name, middle_name, last_name FROM students";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err });
        console.log("All students fetched:", results.length);
        console.log("Student IDs:", results.map(s => ({ id: s.id, name: `${s.first_name} ${s.last_name}` })));
        res.json(results);
    });
});

// Search students
app.get("/api/students/search", (req, res) => {
    const search = req.query.q || ""; // get the query string ?q=
    const sql = `
        SELECT id, first_name, middle_name, last_name
        FROM students
        WHERE first_name LIKE ? OR middle_name LIKE ? OR last_name LIKE ?
        ORDER BY last_name ASC
    `;
    const searchTerm = `%${search}%`;

    db.query(sql, [searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

// Get a single student by ID (full details)
app.get("/api/students/:id", (req, res) => {
    const studentId = req.params.id;
    console.log("\n=== FETCHING STUDENT ===");
    console.log("Student ID requested:", studentId);
    
    const sql = "SELECT * FROM students WHERE id = ?";
    
    db.query(sql, [studentId], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("✅ Query executed successfully");
        console.log("Number of results:", results.length);
        
        if (results.length === 0) {
            console.warn("⚠️ Student not found for id:", studentId);
            return res.status(404).json({ error: "Student not found" });
        }
        
        let student = results[0];
        console.log("📋 Raw student data:", student);
        
        // Parse family_members if it's a string
        if (student.family_members) {
            console.log("Family members (raw):", student.family_members);
            console.log("Family members type:", typeof student.family_members);
            
            if (typeof student.family_members === "string") {
                try {
                    student.family_members = JSON.parse(student.family_members);
                    console.log("✅ Parsed family members:", student.family_members);
                } catch (parseError) {
                    console.error("❌ Error parsing family_members:", parseError);
                    student.family_members = [];
                }
            }
        } else {
            console.log("No family members found");
            student.family_members = [];
        }
        
        console.log("📤 Sending student data to frontend");
        console.log("======================\n");
        res.json(student);
    });
});

// Add new student (full details)
app.post("/api/students", (req, res) => {
    const s = req.body;
    console.log("\n=== ADDING NEW STUDENT ===");
    console.log("Student data:", s);
    
    const sql = `
        INSERT INTO students (
            student_no, first_name, middle_name, last_name, ext_name, program, curriculum_code, date_graduated, lrn,
            citizenship, religion, email, phone, street, barangay, city, province, year_level, admission_date,
            school_year, period, gender, age, section, family_members
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    console.log("Family members JSON:", familyMembersJSON);
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON
    ], (err, result) => {
        if (err) {
            console.error("❌ Error adding student:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ Student added successfully, ID:", result.insertId);
        res.json({ id: result.insertId, ...s });
    });
});

// Update student
app.put("/api/students/:id", (req, res) => {
    const studentId = req.params.id;
    const s = req.body;
    
    console.log("\n=== UPDATING STUDENT ===");
    console.log("Student ID:", studentId);
    console.log("Update data:", s);
    
    const sql = `
        UPDATE students SET
            student_no=?, first_name=?, middle_name=?, last_name=?, ext_name=?, program=?, curriculum_code=?, date_graduated=?, lrn=?,
            citizenship=?, religion=?, email=?, phone=?, street=?, barangay=?, city=?, province=?, year_level=?, admission_date=?,
            school_year=?, period=?, gender=?, age=?, section=?, family_members=?
        WHERE id=?
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    console.log("Family members JSON:", familyMembersJSON);
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON, studentId
    ], (err, result) => {
        if (err) {
            console.error("❌ Error updating student:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ Student updated successfully");
        console.log("Rows affected:", result.affectedRows);
        res.json({ id: studentId, ...s });
    });
});
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    
    console.log("\n=== LOGIN ATTEMPT ===");
    console.log("Username:", username);
    
    const sql = "SELECT * FROM accounts WHERE username = ? AND password = ?";
    
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ 
                success: false, 
                message: "Server error. Please try again later." 
            });
        }
        
        console.log("Query results:", results.length);
        
        if (results.length > 0) {
            console.log("✅ Login successful for user:", username);
            res.json({ 
                success: true, 
                message: "Login successful",
                user: {
                    username: results[0].username
                }
            });
        } else {
            console.log("❌ Invalid credentials for user:", username);
            res.status(401).json({ 
                success: false, 
                message: "Invalid username or password" 
            });
        }
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Database: school_db`);
});

