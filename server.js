const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "school_db"
});

db.connect(err => {
    if (err) {
        console.error("Database connection failed:", err);
        return;
    }
    console.log("Connected to MySQL database.");
});

// ========== STUDENTS ROUTES ========== //

// Get all students (summary)
app.get("/api/students", (req, res) => {
    const sql = "SELECT id, first_name, middle_name, last_name FROM students";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err });
        console.log("All students fetched:", results.length);
        res.json(results);
    });
});

// Search students
app.get("/api/students/search", (req, res) => {
    const search = req.query.q || "";
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
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Student not found" });
        }
        
        let student = results[0];
        
        if (student.family_members && typeof student.family_members === "string") {
            try {
                student.family_members = JSON.parse(student.family_members);
            } catch (parseError) {
                student.family_members = [];
            }
        } else {
            student.family_members = [];
        }
        
        res.json(student);
    });
});

// Add new student
app.post("/api/students", (req, res) => {
    const s = req.body;
    const sql = `
        INSERT INTO students (
            student_no, first_name, middle_name, last_name, ext_name, program, curriculum_code, date_graduated, lrn,
            citizenship, religion, email, phone, street, barangay, city, province, year_level, admission_date,
            school_year, period, gender, age, section, family_members
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON
    ], (err, result) => {
        if (err) {
            console.error("❌ Error adding student:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: result.insertId, ...s });
    });
});

// Update student
app.put("/api/students/:id", (req, res) => {
    const studentId = req.params.id;
    const s = req.body;
    
    const sql = `
        UPDATE students SET
            student_no=?, first_name=?, middle_name=?, last_name=?, ext_name=?, program=?, curriculum_code=?, date_graduated=?, lrn=?,
            citizenship=?, religion=?, email=?, phone=?, street=?, barangay=?, city=?, province=?, year_level=?, admission_date=?,
            school_year=?, period=?, gender=?, age=?, section=?, family_members=?
        WHERE id=?
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON, studentId
    ], (err, result) => {
        if (err) {
            console.error("❌ Error updating student:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: studentId, ...s });
    });
});

// ========== ADMISSIONS ROUTES ========== //

// Get all admissions (summary) - NOW INCLUDES STATUS
app.get("/api/admissions", (req, res) => {
    console.log("\n=== FETCHING ALL ADMISSIONS ===");
    const sql = "SELECT id, first_name, middle_name, last_name, status FROM admissions";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching admissions:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ All admissions fetched:", results.length);
        console.log("Sample data:", results.slice(0, 2)); // Debug log
        res.json(results);
    });
});

// Search admissions
app.get("/api/admissions/search", (req, res) => {
    const search = req.query.q || "";
    const sql = `
        SELECT id, first_name, middle_name, last_name, status
        FROM admissions
        WHERE first_name LIKE ? OR middle_name LIKE ? OR last_name LIKE ?
        ORDER BY last_name ASC
    `;
    const searchTerm = `%${search}%`;
    db.query(sql, [searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

// Get a single admission by ID (full details)
app.get("/api/admissions/:id", (req, res) => {
    const admissionId = req.params.id;
    console.log("\n=== FETCHING ADMISSION ===");
    console.log("Admission ID requested:", admissionId);
    
    const sql = "SELECT * FROM admissions WHERE id = ?";
    db.query(sql, [admissionId], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Admission not found" });
        }
        
        let admission = results[0];
        
        if (admission.family_members && typeof admission.family_members === "string") {
            try {
                admission.family_members = JSON.parse(admission.family_members);
            } catch (parseError) {
                admission.family_members = [];
            }
        } else {
            admission.family_members = [];
        }
        
        console.log("✅ Admission fetched with status:", admission.status);
        res.json(admission);
    });
});

// Add new admission
app.post("/api/admissions", (req, res) => {
    const s = req.body;
    console.log("\n=== ADDING NEW ADMISSION ===");
    
    const sql = `
        INSERT INTO admissions (
            student_no, first_name, middle_name, last_name, ext_name, program, curriculum_code, date_graduated, lrn,
            citizenship, religion, email, phone, street, barangay, city, province, year_level, admission_date,
            school_year, period, gender, age, section, family_members, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    const status = s.status || 'pending';
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON, status
    ], (err, result) => {
        if (err) {
            console.error("❌ Error adding admission:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ Admission added successfully, ID:", result.insertId);
        res.json({ id: result.insertId, status: status, ...s });
    });
});

// Update admission
app.put("/api/admissions/:id", (req, res) => {
    const admissionId = req.params.id;
    const s = req.body;
    
    console.log("\n=== UPDATING ADMISSION ===");
    console.log("Admission ID:", admissionId);
    
    const sql = `
        UPDATE admissions SET
            student_no=?, first_name=?, middle_name=?, last_name=?, ext_name=?, program=?, curriculum_code=?, date_graduated=?, lrn=?,
            citizenship=?, religion=?, email=?, phone=?, street=?, barangay=?, city=?, province=?, year_level=?, admission_date=?,
            school_year=?, period=?, gender=?, age=?, section=?, family_members=?, status=?
        WHERE id=?
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    const status = s.status || 'pending';
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON, status, admissionId
    ], (err, result) => {
        if (err) {
            console.error("❌ Error updating admission:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ Admission updated successfully");
        res.json({ id: admissionId, status: status, ...s });
    });
});

// Delete admission
app.delete("/api/admissions/:id", (req, res) => {
    const admissionId = req.params.id;
    console.log("\n=== DELETING ADMISSION ===");
    console.log("Admission ID:", admissionId);
    
    const sql = "DELETE FROM admissions WHERE id = ?";
    db.query(sql, [admissionId], (err, result) => {
        if (err) {
            console.error("❌ Error deleting admission:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ Admission deleted successfully");
        res.json({ success: true, message: "Admission deleted" });
    });
});

// Update admission status (PATCH) - With Accept/Reject Logic
app.patch("/api/admissions/:id/status", (req, res) => {
    const admissionId = req.params.id;
    const { status } = req.body;
    
    console.log("\n=== UPDATING ADMISSION STATUS ===");
    console.log("Admission ID:", admissionId);
    console.log("New Status:", status);
    
    if (!status || !['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
    }
    
    // First, get the admission data
    const getAdmissionSql = "SELECT * FROM admissions WHERE id = ?";
    
    db.query(getAdmissionSql, [admissionId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching admission:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Admission not found" });
        }
        
        const admission = results[0];
        
        // If status is ACCEPTED - Transfer to students table
        if (status === 'accepted') {
            console.log("📝 Processing ACCEPTED application...");
            
            // Get current year (last 2 digits)
            const currentYear = new Date().getFullYear().toString().slice(-2);
            
            // Count students accepted this year to generate next number
            const countSql = `SELECT COUNT(*) as count FROM students WHERE student_no LIKE 'A${currentYear}-%'`;
            
            db.query(countSql, (err, countResults) => {
                if (err) {
                    console.error("❌ Error counting students:", err);
                    return res.status(500).json({ error: err.message });
                }
                
                const count = countResults[0].count + 1;
                const studentNo = `A${currentYear}-${String(count).padStart(4, '0')}`;
                const admissionDate = new Date().toISOString().split('T')[0];
                
                console.log(`✅ Generated Student No: ${studentNo}`);
                console.log(`✅ Admission Date: ${admissionDate}`);
                
                // Insert into students table
                const insertStudentSql = `
                    INSERT INTO students (
                        student_no, first_name, middle_name, last_name, ext_name, program, 
                        curriculum_code, date_graduated, lrn, citizenship, religion, email, phone, 
                        street, barangay, city, province, year_level, admission_date, school_year, 
                        period, gender, age, section, family_members
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                db.query(insertStudentSql, [
                    studentNo,
                    admission.first_name,
                    admission.middle_name,
                    admission.last_name,
                    admission.ext_name,
                    admission.program,
                    admission.curriculum_code,
                    admission.date_graduated,
                    admission.lrn,
                    admission.citizenship,
                    admission.religion,
                    admission.email,
                    admission.phone,
                    admission.street,
                    admission.barangay,
                    admission.city,
                    admission.province,
                    admission.year_level,
                    admissionDate,
                    admission.school_year,
                    admission.period,
                    admission.gender,
                    admission.age,
                    admission.section,
                    admission.family_members
                ], (err, insertResult) => {
                    if (err) {
                        console.error("❌ Error inserting student:", err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    console.log("✅ Student added to students table with ID:", insertResult.insertId);
                    
                    // Delete from admissions table
                    const deleteSql = "DELETE FROM admissions WHERE id = ?";
                    db.query(deleteSql, [admissionId], (err) => {
                        if (err) {
                            console.error("❌ Error deleting from admissions:", err);
                            return res.status(500).json({ error: err.message });
                        }
                        
                        console.log("✅ Application removed from admissions table");
                        res.json({ 
                            success: true, 
                            message: "Student accepted and enrolled successfully",
                            student_no: studentNo,
                            student_id: insertResult.insertId
                        });
                    });
                });
            });
        }
        // If status is REJECTED - Move to archive table
        else if (status === 'rejected') {
            console.log("📝 Processing REJECTED application...");
            
            const rejectionDate = new Date().toISOString().split('T')[0];
            
            // Insert into archive table
            const insertArchiveSql = `
                INSERT INTO archive (
                    first_name, middle_name, last_name, ext_name, program, 
                    curriculum_code, date_graduated, lrn, citizenship, religion, email, phone, 
                    street, barangay, city, province, year_level, admission_date, school_year, 
                    period, gender, age, section, family_members, rejection_date, rejection_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.query(insertArchiveSql, [
                admission.first_name,
                admission.middle_name,
                admission.last_name,
                admission.ext_name,
                admission.program,
                admission.curriculum_code,
                admission.date_graduated,
                admission.lrn,
                admission.citizenship,
                admission.religion,
                admission.email,
                admission.phone,
                admission.street,
                admission.barangay,
                admission.city,
                admission.province,
                admission.year_level,
                admission.admission_date,
                admission.school_year,
                admission.period,
                admission.gender,
                admission.age,
                admission.section,
                admission.family_members,
                rejectionDate,
                "Application rejected by admin"
            ], (err, insertResult) => {
                if (err) {
                    console.error("❌ Error inserting to archive:", err);
                    return res.status(500).json({ error: err.message });
                }
                
                console.log("✅ Application archived with ID:", insertResult.insertId);
                
                // Delete from admissions table
                const deleteSql = "DELETE FROM admissions WHERE id = ?";
                db.query(deleteSql, [admissionId], (err) => {
                    if (err) {
                        console.error("❌ Error deleting from admissions:", err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    console.log("✅ Application removed from admissions table");
                    res.json({ 
                        success: true, 
                        message: "Application rejected and archived",
                        archive_id: insertResult.insertId
                    });
                });
            });
        }
        // If status is just being updated to PENDING or staying the same
        else {
            const updateSql = "UPDATE admissions SET status = ? WHERE id = ?";
            db.query(updateSql, [status, admissionId], (err, result) => {
                if (err) {
                    console.error("❌ Error updating status:", err);
                    return res.status(500).json({ error: err.message });
                }
                
                console.log("✅ Admission status updated to:", status);
                res.json({ success: true, message: "Status updated", status: status });
            });
        }
    });
});

// ========== LOGIN ROUTE ========== //

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

// ========== START SERVER ========== //

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Database: school_db`);
    console.log(`Available routes:`);
    console.log(`  - GET    /api/students`);
    console.log(`  - GET    /api/students/:id`);
    console.log(`  - POST   /api/students`);
    console.log(`  - PUT    /api/students/:id`);
    console.log(`  - GET    /api/admissions`);
    console.log(`  - GET    /api/admissions/:id`);
    console.log(`  - POST   /api/admissions`);
    console.log(`  - PUT    /api/admissions/:id`);
    console.log(`  - PATCH  /api/admissions/:id/status`);
    console.log(`  - DELETE /api/admissions/:id`);
    console.log(`  - POST   /api/login`);
});
