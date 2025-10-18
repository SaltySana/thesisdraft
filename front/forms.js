// API Base URL - Change port to match your server
const API_URL = "http://localhost:5001";

/**
 * Populate a select dropdown with grade levels
 * @param {string} selectId - The ID of the select element
 * @param {object} options - Object with start and end properties
 */
function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    for (let i = options.start; i <= options.end; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Grade ${i}`;
        select.appendChild(option);
    }
}

/**
 * Setup form submission handler
 * @param {string} formId - The ID of the form element
 * @param {string} dialogId - The ID of the success dialog
 * @param {string} closeButtonId - The ID of the close button
 */
function setupForm(formId, dialogId, closeButtonId) {
    const form = document.getElementById(formId);
    const dialog = document.getElementById(dialogId);
    const closeButton = document.getElementById(closeButtonId);
    
    if (!form || !dialog) {
        console.error("Form or dialog not found");
        return;
    }
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            // Collect form data
            const formData = new FormData(form);
            
            // Prepare student data object
            const studentData = {
                student_no: "", // Will be auto-generated or set by admin
                first_name: formData.get('first_name'),
                middle_name: formData.get('middle_name'),
                last_name: formData.get('last_name'),
                ext_name: formData.get('ext_name') || "",
                program: formData.get('program'),
                curriculum_code: "", // Optional field
                date_graduated: formData.get('date_graduated') || null,
                lrn: formData.get('lrn'),
                citizenship: formData.get('citizenship'),
                religion: formData.get('religion'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                street: formData.get('street'),
                barangay: formData.get('barangay'),
                city: formData.get('city'),
                province: formData.get('province'),
                year_level: formData.get('year_level'),
                admission_date: formData.get('admission_date'),
                school_year: formData.get('school_year'),
                period: formData.get('period'),
                gender: formData.get('gender'),
                age: formData.get('age') || 0,
                section: "", // Will be assigned later by admin
                status: "pending" // New applications default to pending
            };
            
            // Collect family members
            const familyMembers = [];
            const relations = formData.getAll('family_relation[]');
            const names = formData.getAll('family_name[]');
            const occupations = formData.getAll('family_occupation[]');
            const contacts = formData.getAll('family_contact[]');
            const addresses = formData.getAll('family_address[]');
            
            for (let i = 0; i < relations.length; i++) {
                // Only add family member if relation and name are provided
                if (relations[i] && names[i]) {
                    familyMembers.push({
                        id: `family-${i + 1}`,
                        relation: relations[i],
                        name: names[i],
                        occupation: occupations[i] || "",
                        contact: contacts[i] || "",
                        address: addresses[i] || ""
                    });
                }
            }
            
            studentData.family_members = familyMembers;
            
            // Add achievement for Grade 7 students
            const achievement = document.querySelector('input[name="achievement"]:checked');
            if (achievement) {
                studentData.achievement = achievement.value;
            }
            
            // Add previous school information if provided
            const previousSchool = formData.get('previous_school');
            const previousAddress = formData.get('previous_address');
            if (previousSchool) {
                studentData.previous_school = previousSchool;
            }
            if (previousAddress) {
                studentData.previous_school_address = previousAddress;
            }
            
            console.log("Submitting student data:", studentData);
            
            // Submit to API
            const response = await fetch(`${API_URL}/api/admissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(studentData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log("Application submitted successfully:", result);
                
                // Show success dialog
                dialog.showModal();
                
                // Reset form
                form.reset();
                
                // Hide Grade 7 options if they were showing
                const grade7Options = document.getElementById('grade7Options');
                if (grade7Options) {
                    grade7Options.style.display = 'none';
                }
            } else {
                const error = await response.json();
                console.error("Server error:", error);
                alert(`Error submitting application: ${error.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("Could not submit application. Please check your internet connection and try again.");
        }
    });
    
    // Handle close button
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            dialog.close();
        });
    }
    
    // Close dialog when clicking outside
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.close();
        }
    });
}

/**
 * Load and display submitted applications (for admin use)
 */
async function loadApplications() {
    try {
        const response = await fetch(`${API_URL}/api/admissions`);
        
        if (response.ok) {
            const applications = await response.json();
            console.log("Applications loaded:", applications);
            return applications;
        } else {
            console.error("Error loading applications");
            return [];
        }
    } catch (error) {
        console.error("Error fetching applications:", error);
        return [];
    }
}

/**
 * Get a single application by ID
 */
async function getApplication(id) {
    try {
        const response = await fetch(`${API_URL}/api/admissions/${id}`);
        
        if (response.ok) {
            const application = await response.json();
            return application;
        } else {
            console.error("Error loading application");
            return null;
        }
    } catch (error) {
        console.error("Error fetching application:", error);
        return null;
    }
}

/**
 * Update application status
 */
async function updateApplicationStatus(id, status) {
    try {
        const response = await fetch(`${API_URL}/api/admissions/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log("Status updated:", result);
            return true;
        } else {
            console.error("Error updating status");
            return false;
        }
    } catch (error) {
        console.error("Error updating status:", error);
        return false;
    }
}