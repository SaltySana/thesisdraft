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
app.get("/api/admissions/all", (req, res) => {
    console.log("\n=== FETCHING ALL REGISTRATIONS (MULTI-TABLE) ===");
    
    // Query 1: Get pending applications from admissions table
    const pendingSql = `
        SELECT id, first_name, middle_name, last_name, 'pending' as status, 'admissions' as source_table
        FROM admissions
    `;
    
    // Query 2: Get accepted students from students table
    const acceptedSql = `
        SELECT id, first_name, middle_name, last_name, 'accepted' as status, 'students' as source_table
        FROM students
    `;
    
    // Query 3: Get rejected applications from archive table
    const rejectedSql = `
        SELECT id, first_name, middle_name, last_name, 'rejected' as status, 'archive' as source_table
        FROM archive
    `;
    
    // Execute all three queries
    db.query(pendingSql, (err1, pendingResults) => {
        if (err1) {
            console.error("❌ Error fetching pending:", err1);
            return res.status(500).json({ error: err1.message });
        }
        
        db.query(acceptedSql, (err2, acceptedResults) => {
            if (err2) {
                console.error("❌ Error fetching accepted:", err2);
                return res.status(500).json({ error: err2.message });
            }
            
            db.query(rejectedSql, (err3, rejectedResults) => {
                if (err3) {
                    console.error("❌ Error fetching rejected:", err3);
                    return res.status(500).json({ error: err3.message });
                }
                
                // Combine all results
                const allRegistrations = [
                    ...pendingResults,
                    ...acceptedResults,
                    ...rejectedResults
                ];
                
                console.log("✅ All registrations fetched:");
                console.log("   - Pending:", pendingResults.length);
                console.log("   - Accepted:", acceptedResults.length);
                console.log("   - Rejected:", rejectedResults.length);
                console.log("   - Total:", allRegistrations.length);
                
                res.json(allRegistrations);
            });
        });
    });
});

// Add this NEW route to get details from the correct table based on status
app.get("/api/registrations/:status/:id", (req, res) => {
    const { status, id } = req.params;
    console.log("\n=== FETCHING REGISTRATION DETAILS ===");
    console.log("Status:", status, "ID:", id);
    
    let table;
    if (status === 'pending') {
        table = 'admissions';
    } else if (status === 'accepted') {
        table = 'students';
    } else if (status === 'rejected') {
        table = 'archive';
    } else {
        return res.status(400).json({ error: "Invalid status" });
    }
    
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Record not found" });
        }
        
        let record = results[0];
        record.status = status;
        record.source_table = table;
        
        // Parse family_members if exists
        if (record.family_members && typeof record.family_members === "string") {
            try {
                record.family_members = JSON.parse(record.family_members);
            } catch (parseError) {
                record.family_members = [];
            }
        } else {
            record.family_members = [];
        }
        
        // Parse student_subjects if exists (for accepted students)
        if (record.student_subjects && typeof record.student_subjects === "string") {
            try {
                record.student_subjects = JSON.parse(record.student_subjects);
            } catch (parseError) {
                record.student_subjects = [];
            }
        } else {
            record.student_subjects = [];
        }
        
        console.log("✅ Record fetched from", table);
        res.json(record);
    });
});
// Get all students (summary)
app.get("/api/students", (req, res) => {
    const sql = "SELECT id, student_no, first_name, middle_name, last_name, year_level FROM students";
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
        SELECT id, student_no, first_name, middle_name, last_name, year_level
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

        // Parse student_subjects if exists
        if (student.student_subjects && typeof student.student_subjects === "string") {
            try {
                student.student_subjects = JSON.parse(student.student_subjects);
            } catch (parseError) {
                student.student_subjects = [];
            }
        } else {
            student.student_subjects = [];
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
            school_year, period, gender, age, section, family_members, student_subjects
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    const studentSubjectsJSON = JSON.stringify(s.student_subjects || []);
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON, studentSubjectsJSON
    ], (err, result) => {
        if (err) {
            console.error("❌ Error adding student:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ Student added with subjects:", s.student_subjects);
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
            school_year=?, period=?, gender=?, age=?, section=?, family_members=?, student_subjects=?
        WHERE id=?
    `;
    
    const familyMembersJSON = JSON.stringify(s.family_members || []);
    const studentSubjectsJSON = JSON.stringify(s.student_subjects || []);
    
    db.query(sql, [
        s.student_no, s.first_name, s.middle_name, s.last_name, s.ext_name, s.program, s.curriculum_code, s.date_graduated, s.lrn,
        s.citizenship, s.religion, s.email, s.phone, s.street, s.barangay, s.city, s.province, s.year_level, s.admission_date,
        s.school_year, s.period, s.gender, s.age, s.section, familyMembersJSON, studentSubjectsJSON, studentId
    ], (err, result) => {
        if (err) {
            console.error("❌ Error updating student:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ Student updated with subjects:", s.student_subjects);
        res.json({ id: studentId, ...s });
    });
});

// Get all archived (rejected) applications
app.get("/api/archive", (req, res) => {
    console.log("\n=== FETCHING ALL ARCHIVED APPLICATIONS ===");
    const sql = "SELECT id, first_name, middle_name, last_name, 'rejected' as status FROM archive";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching archive:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ All archived applications fetched:", results.length);
        res.json(results);
    });
});

// Get a single archived application by ID
app.get("/api/archive/:id", (req, res) => {
    const archiveId = req.params.id;
    console.log("\n=== FETCHING ARCHIVED APPLICATION ===");
    console.log("Archive ID requested:", archiveId);
    
    const sql = "SELECT * FROM archive WHERE id = ?";
    db.query(sql, [archiveId], (err, results) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Archived application not found" });
        }
        
        let archive = results[0];
        archive.status = 'rejected';
        
        if (archive.family_members && typeof archive.family_members === "string") {
            try {
                archive.family_members = JSON.parse(archive.family_members);
            } catch (parseError) {
                archive.family_members = [];
            }
        } else {
            archive.family_members = [];
        }
        
        console.log("✅ Archived application fetched");
        res.json(archive);
    });
});

// ========== ADMISSIONS ROUTES ========== //

// Get all admissions (summary)
app.get("/api/admissions", (req, res) => {
    console.log("\n=== FETCHING ALL ADMISSIONS ===");
    const sql = "SELECT id, first_name, middle_name, last_name, status FROM admissions";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching admissions:", err);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ All admissions fetched:", results.length);
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

// Get a single admission by ID
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

// Update admission status (PATCH)
app.patch("/api/admissions/:id/status", (req, res) => {
    const admissionId = req.params.id;
    const { status } = req.body;
    
    console.log("\n=== UPDATING ADMISSION STATUS ===");
    console.log("Admission ID:", admissionId);
    console.log("New Status:", status);
    
    if (!status || !['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
    }
    
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
        
        if (status === 'accepted') {
            console.log("📝 Processing ACCEPTED application...");
            
            const currentYear = new Date().getFullYear().toString().slice(-2);
            const countSql = `SELECT COUNT(*) as count FROM students WHERE student_no LIKE 'A${currentYear}-%'`;
            
            db.query(countSql, (err, countResults) => {
                if (err) {
                    console.error("❌ Error counting students:", err);
                    return res.status(500).json({ error: err.message });
                }
                
                const count = countResults[0].count + 1;
                const studentNo = `A${currentYear}-${String(count).padStart(4, '0')}`;
                const admissionDate = new Date().toISOString().split('T')[0];
                
                const insertStudentSql = `
                    INSERT INTO students (
                        student_no, first_name, middle_name, last_name, ext_name, program, 
                        curriculum_code, date_graduated, lrn, citizenship, religion, email, phone, 
                        street, barangay, city, province, year_level, admission_date, school_year, 
                        period, gender, age, section, family_members
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                db.query(insertStudentSql, [
                    studentNo, admission.first_name, admission.middle_name, admission.last_name, admission.ext_name,
                    admission.program, admission.curriculum_code, admission.date_graduated, admission.lrn,
                    admission.citizenship, admission.religion, admission.email, admission.phone, admission.street,
                    admission.barangay, admission.city, admission.province, admission.year_level, admissionDate,
                    admission.school_year, admission.period, admission.gender, admission.age, admission.section,
                    admission.family_members
                ], (err, insertResult) => {
                    if (err) {
                        console.error("❌ Error inserting student:", err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    const deleteSql = "DELETE FROM admissions WHERE id = ?";
                    db.query(deleteSql, [admissionId], (err) => {
                        if (err) {
                            console.error("❌ Error deleting from admissions:", err);
                            return res.status(500).json({ error: err.message });
                        }
                        
                        res.json({ 
                            success: true, 
                            message: "Student accepted and enrolled successfully",
                            student_no: studentNo,
                            student_id: insertResult.insertId
                        });
                    });
                });
            });
        } else if (status === 'rejected') {
            console.log("📝 Processing REJECTED application...");
            
            const rejectionDate = new Date().toISOString().split('T')[0];
            
            const insertArchiveSql = `
                INSERT INTO archive (
                    first_name, middle_name, last_name, ext_name, program, 
                    curriculum_code, date_graduated, lrn, citizenship, religion, email, phone, 
                    street, barangay, city, province, year_level, admission_date, school_year, 
                    period, gender, age, section, family_members, rejection_date, rejection_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.query(insertArchiveSql, [
                admission.first_name, admission.middle_name, admission.last_name, admission.ext_name,
                admission.program, admission.curriculum_code, admission.date_graduated, admission.lrn,
                admission.citizenship, admission.religion, admission.email, admission.phone, admission.street,
                admission.barangay, admission.city, admission.province, admission.year_level, admission.admission_date,
                admission.school_year, admission.period, admission.gender, admission.age, admission.section,
                admission.family_members, rejectionDate, "Application rejected by admin"
            ], (err, insertResult) => {
                if (err) {
                    console.error("❌ Error inserting to archive:", err);
                    return res.status(500).json({ error: err.message });
                }
                
                const deleteSql = "DELETE FROM admissions WHERE id = ?";
                db.query(deleteSql, [admissionId], (err) => {
                    if (err) {
                        console.error("❌ Error deleting from admissions:", err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    res.json({ 
                        success: true, 
                        message: "Application rejected and archived",
                        archive_id: insertResult.insertId
                    });
                });
            });
        } else {
            const updateSql = "UPDATE admissions SET status = ? WHERE id = ?";
            db.query(updateSql, [status, admissionId], (err, result) => {
                if (err) {
                    console.error("❌ Error updating status:", err);
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ success: true, message: "Status updated", status: status });
            });
        }
    });
});

// ========== SECTIONS ROUTES ========== //

// Get all sections from database
app.get("/api/sections", (req, res) => {
    console.log("\n=== FETCHING ALL SECTIONS ===");
    const sql = "SELECT grade_level, name, school_year, adviser FROM section ORDER BY grade_level, name";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching sections:", err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("✅ Sections fetched:", results.length);
        
        // Transform results to match expected format
        const sections = results.map((row, index) => ({
            id: `${row.grade_level}-${row.name}`,
            section_name: row.name,
            grade_level: row.grade_level,
            school_year: row.school_year,
            adviser: row.adviser,
            students: [],
            subjects: []
        }));
        
        res.json(sections);
    });
});

// Get single section
app.get("/api/sections/:id", (req, res) => {
    const sectionId = req.params.id;
    const [gradeLevel, sectionName] = sectionId.split('-');
    
    console.log("\n=== FETCHING SECTION DETAILS ===");
    console.log("Grade Level:", gradeLevel, "Section:", sectionName);
    
    const sectionSql = "SELECT * FROM section WHERE grade_level = ? AND name = ?";
    
    db.query(sectionSql, [gradeLevel, sectionName], (err, sectionResults) => {
        if (err) {
            console.error("❌ Error fetching section:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (sectionResults.length === 0) {
            return res.status(404).json({ error: "Section not found" });
        }
        
        const section = sectionResults[0];
        
        // Get students assigned to this section
        const studentsSql = "SELECT id FROM students WHERE section = ?";
        db.query(studentsSql, [sectionName], (err, studentResults) => {
            if (err) {
                console.error("❌ Error fetching students:", err);
                return res.status(500).json({ error: err.message });
            }
            
            // Get subjects for this grade level
            const subjectsSql = "SELECT subjects FROM subjects WHERE grade = ?";
            db.query(subjectsSql, [gradeLevel], (err, subjectResults) => {
                if (err) {
                    console.error("❌ Error fetching subjects:", err);
                    return res.status(500).json({ error: err.message });
                }
                
                const response = {
                    id: sectionId,
                    section_name: section.name,
                    grade_level: section.grade_level,
                    school_year: section.school_year,
                    adviser: section.adviser,
                    students: studentResults.map(s => s.id),
                    subjects: subjectResults.map(s => ({
                        name: s.subjects,
                        teacher: ''
                    }))
                };
                
                res.json(response);
            });
        });
    });
});

// Create new section
app.post("/api/sections", (req, res) => {
    const { section_name, grade_level, school_year, adviser, students, subjects } = req.body;
    
    console.log("\n=== CREATING NEW SECTION ===");
    console.log("Section:", section_name, "Grade:", grade_level);
    
    // Extract grade number from "Grade X" format
    const gradeNum = grade_level.replace('Grade ', '');
    
    const sql = "INSERT INTO section (grade_level, name, school_year, adviser) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [gradeNum, section_name, school_year, adviser], (err, result) => {
        if (err) {
            console.error("❌ Error creating section:", err);
            return res.status(500).json({ error: err.message });
        }
        
        // Update students with section assignment and subjects
        if (students && students.length > 0) {
            const subjectNames = subjects ? subjects.map(s => s.name) : [];
            const subjectsJSON = JSON.stringify(subjectNames);
            
            const updateSql = "UPDATE students SET section = ?, student_subjects = ? WHERE id IN (?)";
            db.query(updateSql, [section_name, subjectsJSON, students], (err) => {
                if (err) {
                    console.error("❌ Error assigning students and subjects:", err);
                } else {
                    console.log("✅ Assigned subjects to students:", subjectNames);
                }
            });
        }
        
        console.log("✅ Section created successfully");
        res.json({ 
            success: true, 
            message: "Section created successfully",
            id: `${gradeNum}-${section_name}`
        });
    });
});

// Update section
app.put("/api/sections/:id", (req, res) => {
    const sectionId = req.params.id;
    const [oldGradeLevel, oldSectionName] = sectionId.split('-');
    const { section_name, grade_level, school_year, adviser, students } = req.body;
    
    console.log("\n=== UPDATING SECTION ===");
    console.log("Old:", oldSectionName, "New:", section_name);
    
    const gradeNum = grade_level.replace('Grade ', '');
    
    const sql = "UPDATE section SET name = ?, grade_level = ?, school_year = ?, adviser = ? WHERE grade_level = ? AND name = ?";
    
    db.query(sql, [section_name, gradeNum, school_year, adviser, oldGradeLevel, oldSectionName], (err, result) => {
        if (err) {
            console.error("❌ Error updating section:", err);
            return res.status(500).json({ error: err.message });
        }
        
        // Clear old assignments
        const clearSql = "UPDATE students SET section = NULL WHERE section = ?";
        db.query(clearSql, [oldSectionName], (err) => {
            if (err) {
                console.error("❌ Error clearing old assignments:", err);
            }
            
            // Assign new students
            if (students && students.length > 0) {
                const updateSql = "UPDATE students SET section = ? WHERE id IN (?)";
                db.query(updateSql, [section_name, students], (err) => {
                    if (err) {
                        console.error("❌ Error assigning students:", err);
                    }
                });
            }
        });
        
        console.log("✅ Section updated successfully");
        res.json({ 
            success: true, 
            message: "Section updated successfully"
        });
    });
});

// Get all subjects
app.get("/api/subjects", (req, res) => {
    console.log("\n=== FETCHING ALL SUBJECTS ===");
    const sql = "SELECT subjects, grade FROM subjects ORDER BY grade, subjects";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching subjects:", err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("✅ Subjects fetched:", results.length);
        res.json(results);
    });
});

// Get subjects by grade level
app.get("/api/subjects/:grade", (req, res) => {
    const grade = req.params.grade;
    console.log("\n=== FETCHING SUBJECTS FOR GRADE", grade, "===");
    
    const sql = "SELECT subjects FROM subjects WHERE grade = ? ORDER BY subjects";
    
    db.query(sql, [grade], (err, results) => {
        if (err) {
            console.error("❌ Error fetching subjects:", err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("✅ Subjects fetched:", results.length);
        res.json(results);
    });
});
// ========== SUCCESSION MANAGEMENT ROUTES ========== //

// Get all sections with succession data
app.get("/api/sections/successions/all", (req, res) => {
    console.log("\n=== FETCHING ALL SECTIONS WITH SUCCESSION DATA ===");
    
    const sql = `
        SELECT 
            grade_level,
            name,
            school_year,
            adviser,
            next_grade_level,
            next_section_name
        FROM section
        ORDER BY grade_level, name
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching sections with succession:", err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("✅ Sections with succession data fetched:", results.length);
        res.json(results);
    });
});

// Get succession mapping for a section
app.get("/api/sections/:gradeLevel/:sectionName/succession", (req, res) => {
    const { gradeLevel, sectionName } = req.params;
    
    console.log("\n=== FETCHING SECTION SUCCESSION ===");
    console.log("Section:", sectionName, "Grade:", gradeLevel);
    
    const sql = `
        SELECT next_grade_level, next_section_name 
        FROM section 
        WHERE grade_level = ? AND name = ?
    `;
    
    db.query(sql, [gradeLevel, sectionName], (err, results) => {
        if (err) {
            console.error("❌ Error fetching succession:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: "Section not found" });
        }
        
        res.json({
            current_grade: gradeLevel,
            current_section: sectionName,
            next_grade: results[0].next_grade_level,
            next_section: results[0].next_section_name
        });
    });
});

// Update succession mapping for a section
app.put("/api/sections/:gradeLevel/:sectionName/succession", (req, res) => {
    const { gradeLevel, sectionName } = req.params;
    const { next_grade_level, next_section_name } = req.body;
    
    console.log("\n=== UPDATING SECTION SUCCESSION ===");
    console.log("Current:", sectionName, "Grade:", gradeLevel);
    console.log("Next:", next_section_name, "Grade:", next_grade_level);
    
    const sql = `
        UPDATE section 
        SET next_grade_level = ?, next_section_name = ? 
        WHERE grade_level = ? AND name = ?
    `;
    
    db.query(sql, [next_grade_level, next_section_name, gradeLevel, sectionName], (err, result) => {
        if (err) {
            console.error("❌ Error updating succession:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Section not found" });
        }
        
        console.log("✅ Succession updated successfully");
        res.json({ 
            success: true, 
            message: "Succession mapping updated",
            current: { grade: gradeLevel, section: sectionName },
            next: { grade: next_grade_level, section: next_section_name }
        });
    });
});

// Get available next sections for a grade level
app.get("/api/sections/grade/:nextGrade/available", (req, res) => {
    const nextGrade = req.params.nextGrade;
    
    console.log("\n=== FETCHING AVAILABLE SECTIONS FOR GRADE", nextGrade, "===");
    
    const sql = `
        SELECT name 
        FROM section 
        WHERE grade_level = ? 
        ORDER BY name
    `;
    
    db.query(sql, [nextGrade], (err, results) => {
        if (err) {
            console.error("❌ Error fetching sections:", err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("✅ Available sections fetched:", results.length);
        res.json(results);
    });
});

// Clear succession mapping
app.delete("/api/sections/:gradeLevel/:sectionName/succession", (req, res) => {
    const { gradeLevel, sectionName } = req.params;
    
    console.log("\n=== CLEARING SECTION SUCCESSION ===");
    console.log("Section:", sectionName, "Grade:", gradeLevel);
    
    const sql = `
        UPDATE section 
        SET next_grade_level = NULL, next_section_name = NULL 
        WHERE grade_level = ? AND name = ?
    `;
    
    db.query(sql, [gradeLevel, sectionName], (err, result) => {
        if (err) {
            console.error("❌ Error clearing succession:", err);
            return res.status(500).json({ error: err.message });
        }
        
        console.log("✅ Succession cleared successfully");
        res.json({ success: true, message: "Succession mapping cleared" });
    });
});

// Add these routes to the server startup log

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
    console.log(`  - GET    /api/sections`);
    console.log(`  - GET    /api/sections/:id`);
    console.log(`  - POST   /api/sections`);
    console.log(`  - PUT    /api/sections/:id`);
    console.log(`  - GET    /api/subjects`);
    console.log(`  - GET    /api/subjects/:grade`);
    console.log(`  - GET    /api/sections/successions/all`);
console.log(`  - GET    /api/sections/:gradeLevel/:sectionName/succession`);
console.log(`  - PUT    /api/sections/:gradeLevel/:sectionName/succession`);
console.log(`  - GET    /api/sections/grade/:nextGrade/available`);
console.log(`  - DELETE /api/sections/:gradeLevel/:sectionName/succession`);
    console.log(`  - POST   /api/login`);
});
