// === SECURE SHA-256 HASHING ===
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// admin-script.js - FULLY FUNCTIONAL + EDIT MESSAGES + FIXED MODAL

const DeptStore = {
    init() {
        if (!localStorage.getItem('departments')) localStorage.setItem('departments', JSON.stringify([]));
    },
    get() { return JSON.parse(localStorage.getItem('departments') || '[]'); },
    save(d) { localStorage.setItem('departments', JSON.stringify(d)); }
};
DeptStore.init();

// Global DataStore (shared with script.js)
if (typeof DataStore === 'undefined') {
    const DataStore = {
        getUsers() { return JSON.parse(localStorage.getItem('users') || '[]'); },
        saveUsers(u) { localStorage.setItem('users', JSON.stringify(u)); },
        getClaims() { return JSON.parse(localStorage.getItem('claims') || '[]'); },
        saveClaims(c) { localStorage.setItem('claims', JSON.stringify(c)); },
        getAdmins() { return JSON.parse(localStorage.getItem('admins') || '[]'); },
        getMessages() { return JSON.parse(localStorage.getItem('messages') || '[]'); },
        saveMessages(m) { localStorage.setItem('messages', JSON.stringify(m)); },
        getDonations() { return JSON.parse(localStorage.getItem('donations') || '[]'); },
        saveDonations(d) { localStorage.setItem('donations', JSON.stringify(d)); }
    };
    window.DataStore = DataStore;
}

async function loginAdmin(email, password) {
    const admins = DataStore.getAdmins();

    // Hash the input password
    const hashedInput = await hashPassword(password);

    // Check stored admins
    const found = admins.find(a => a.email === email && a.password === hashedInput);
    if (found) return { email: found.email };

    // === DEFAULT ADMIN (SECURE) ===
    const DEFAULT_ADMIN_EMAIL = 'admin@fundraising.com';
    const DEFAULT_ADMIN_HASH = 'f865b53623b121fd34ee5426c792e5c33af8c2271169292f8d0d6d5eaca2d9f9';

    if (email === DEFAULT_ADMIN_EMAIL && hashedInput === DEFAULT_ADMIN_HASH) {
        return { email };
    }

    return null;
}

function handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('admin-login-email')?.value.trim();
    const password = document.getElementById('admin-login-password')?.value;
    if (!email || !password) return alert('Fill all fields');
    const admin = loginAdmin(email, password);
    if (admin) {
        localStorage.setItem('currentAdmin', JSON.stringify(admin));
        window.location.href = 'admin.html';
    } else {
        alert('Invalid email or password');
    }
}

function adminLogout() {
    localStorage.removeItem('currentAdmin');
    window.location.href = 'admin-login.html';
}

function showAdminSection(section) {
    const sections = ['pending-claims', 'all-claims', 'manage-users', 'send-message', 'donation-management', 'system-stats', 'department-contact'];
    sections.forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`${section}-section`);
    if (target) target.classList.remove('hidden');

    if (section === 'pending-claims') loadPendingClaims();
    else if (section === 'all-claims') loadAllClaims();
    else if (section === 'manage-users') loadUsers();
    else if (section === 'send-message') loadSentMessages();
    else if (section === 'donation-management') loadDonationManagement();
    else if (section === 'system-stats') loadSystemStats();
    else if (section === 'department-contact') loadDepartments();
}

function loadPendingClaims() {
    const container = document.getElementById('pending-claims-list');
    if (!container) return;
    const claims = DataStore.getClaims().filter(c => c.status === 'pending');
    container.innerHTML = claims.length === 0
        ? '<div style="text-align:center; padding:50px; color:#95a5a6;"><h4>No Pending Claims</h4></div>'
        : claims.map(c => `
            <div class="card" style="margin-bottom:20px;">
                <h3>Claim #${c.id}</h3>
                <p><strong>Student:</strong> ${c.claimerName}</p>
                <p><strong>Amount:</strong> PKR${c.amount}</p>
                <p><strong>Department:</strong> ${c.department}</p>
                <p><strong>Semester:</strong> ${c.semester || '-'}</p>
                <p><strong>Description:</strong> ${c.description}</p>
                ${c.hodFile ? `<p><strong>HOD Doc:</strong> <a href="#" onclick="event.preventDefault(); downloadFile('${c.hodFile.name}', '${c.hodFile.type}', '${c.hodFile.data}')" style="color:#3498db;">${c.hodFile.name}</a></p>` : ''}
                ${c.hodNo ? `<p><strong>HOD No:</strong> ${c.hodNo}</p>` : ''}
                ${c.adminOfficeNo ? `<p><strong>Easypasia NO:</strong> ${c.adminOfficeNo}</p>` : ''}
                <p><strong>Submitted:</strong> ${new Date(c.dateSubmitted).toLocaleString()}</p>
                <div style="margin-top:15px;">
                    <button class="btn btn-primary btn-sm" onclick="approveClaim(${c.id})">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectClaim(${c.id})">Reject</button>
                </div>
            </div>
        `).join('');
}

function approveClaim(id) { updateClaimStatus(id, 'approved'); }
function rejectClaim(id) { updateClaimStatus(id, 'rejected'); }

function updateClaimStatus(id, status) {
    const claims = DataStore.getClaims();
    const idx = claims.findIndex(c => c.id === id);
    if (idx !== -1) {
        claims[idx].status = status;
        DataStore.saveClaims(claims);
        loadPendingClaims();
        if (!document.getElementById('all-claims-section').classList.contains('hidden')) loadAllClaims();
    }
}

function loadAllClaims() {
    const tbody = document.getElementById('all-claims-list');
    if (!tbody) return;
    const claims = DataStore.getClaims();
    tbody.innerHTML = claims.map(c => `
        <tr>
            <td>${c.id}</td>
            <td>${c.claimerName}</td>
            <td>PKR${c.amount}</td>
            <td>${c.department}</td>
            <td>${c.semester || '-'}</td>
            <td>${new Date(c.dateSubmitted).toLocaleDateString()}</td>
            <td><span class="status-${c.status}">${c.status}</span></td>
            <td>
                <button class="btn btn-info btn-sm" onclick="viewClaimDetails(${c.id})">View</button>
                <button class="btn btn-danger btn-sm" onclick="deleteClaim(${c.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function deleteClaim(id) {
    if (confirm('Delete this claim permanently?')) {
        DataStore.saveClaims(DataStore.getClaims().filter(c => c.id !== id));
        loadAllClaims();
        loadPendingClaims();
    }
}

function loadUsers() {
    const tbody = document.getElementById('users-list');
    if (!tbody) return;
    const users = DataStore.getUsers();
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>${new Date(u.registrationDate).toLocaleDateString()}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Delete</button></td>
        </tr>
    `).join('');
}

function deleteUser(id) {
    if (confirm('Delete this user? All claims will be lost.')) {
        DataStore.saveUsers(DataStore.getUsers().filter(u => u.id !== id));
        loadUsers();
    }
}

// === MESSAGES: SEND + EDIT + DELETE ===
function loadSentMessages() {
    const container = document.getElementById('sent-messages-list');
    if (!container) return;
    const messages = DataStore.getMessages().sort((a, b) => b.id - a.id);
    container.innerHTML = messages.length === 0
        ? '<p style="text-align:center; color:#95a5a6; padding:40px;">No messages sent yet.</p>'
        : messages.map(m => `
            <div class="message-card" id="msg-${m.id}">
                <div class="message-header">
                    <span class="message-sender">To: ${m.recipient === 'all' ? 'Everyone' : m.recipient === 'claimers' ? 'Students' : 'Donors'}</span>
                    <span class="message-date">${new Date(m.dateSent).toLocaleString()}</span>
                </div>
                <div class="message-subject" onclick="editMessageSubject(${m.id})" style="cursor:pointer; font-weight:600; color:#2c3e50;">
                    ${m.subject} <small style="color:#3498db;">(click to edit)</small>
                </div>
                <div class="message-content" onclick="editMessageContent(${m.id})" style="cursor:pointer;">
                    ${m.content.replace(/\n/g, '<br>')} <small style="color:#3498db;">(click to edit)</small>
                </div>
                <div style="margin-top:10px;">
                    <button class="btn btn-warning btn-sm" onclick="openEditMessageModal(${m.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMessage(${m.id})">Delete</button>
                </div>
            </div>
        `).join('');
}

function openEditMessageModal(msgId) {
    const msg = DataStore.getMessages().find(m => m.id === msgId);
    if (!msg) return;

    const modal = document.createElement('div');
    modal.id = 'edit-message-modal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:3000; padding:20px;';
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:600px;">
            <h3>Edit Message</h3>
            <form id="edit-message-form">
                <input type="hidden" id="edit-msg-id" value="${msg.id}">
                <div class="form-group">
                    <label>Recipient</label>
                    <select id="edit-msg-recipient" class="form-control">
                        <option value="all" ${msg.recipient === 'all' ? 'selected' : ''}>Everyone</option>
                        <option value="claimers" ${msg.recipient === 'claimers' ? 'selected' : ''}>Students</option>
                        <option value="donors" ${msg.recipient === 'donors' ? 'selected' : ''}>Donors</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Subject</label>
                    <input type="text" id="edit-msg-subject" class="form-control" value="${msg.subject}" required>
                </div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea id="edit-msg-content" class="form-control" rows="5" required>${msg.content}</textarea>
                </div>
                <div style="text-align:right; margin-top:15px;">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('edit-message-modal')?.remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('edit-message-form').onsubmit = function (e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-msg-id').value);
        const recipient = document.getElementById('edit-msg-recipient').value;
        const subject = document.getElementById('edit-msg-subject').value.trim();
        const content = document.getElementById('edit-msg-content').value.trim();

        if (!subject || !content) return alert('Fill all fields');

        const messages = DataStore.getMessages();
        const idx = messages.findIndex(m => m.id === id);
        if (idx !== -1) {
            messages[idx].recipient = recipient;
            messages[idx].subject = subject;
            messages[idx].content = content;
            DataStore.saveMessages(messages);
            document.getElementById('edit-message-modal').remove();
            loadSentMessages();
            showAlert('message-alert', 'Message updated!', 'success');
        }
    };
}

function deleteMessage(id) {
    if (confirm('Delete this message permanently?')) {
        DataStore.saveMessages(DataStore.getMessages().filter(m => m.id !== id));
        loadSentMessages();
    }
}

// Send new message
document.getElementById('message-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const recipient = document.getElementById('message-recipient').value;
    const subject = document.getElementById('message-subject').value.trim();
    const content = document.getElementById('message-content').value.trim();
    if (!subject || !content) return alert('Fill subject and message');
    const messages = DataStore.getMessages();
    messages.push({
        id: Date.now(),
        recipient,
        subject,
        content,
        dateSent: new Date().toISOString()
    });
    DataStore.saveMessages(messages);
    e.target.reset();
    loadSentMessages();
    showAlert('message-alert', 'Message sent!', 'success');
});

// === DONATIONS ===
function loadDonationManagement() {
    const donations = DataStore.getDonations();
    const total = donations.reduce((s, d) => s + d.amount, 0);
    document.getElementById('total-funds').textContent = `PKR${total}`;
    document.getElementById('total-donations').textContent = donations.length;
    document.getElementById('active-claims').textContent = DataStore.getClaims().filter(c => c.status === 'approved').length;

    const tbody = document.getElementById('all-donations-list');
    if (!tbody) return;
    tbody.innerHTML = donations.map(d => {
        const claim = DataStore.getClaims().find(c => c.id === d.claimId);
        return `<tr>
            <td>${d.id}</td>
            <td>${d.donorName}</td>
            <td>${claim ? claim.claimerName : '—'}</td>
            <td>PKR${d.amount}</td>
            <td>${d.paymentMethod}</td>
            <td>${d.transactionId}</td>
            <td>${new Date(d.date).toLocaleDateString()}</td>
            <td><span class="status-${d.status}">${d.status}</span></td>
            <td>
                ${d.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="verifyDonation(${d.id})">Verify</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteDonation(${d.id})">Delete</button>
            </td>
        </tr>`;
    }).join('');
}

function verifyDonation(id) {
    const donations = DataStore.getDonations();
    const idx = donations.findIndex(d => d.id === id);
    if (idx !== -1) {
        donations[idx].status = 'verified';
        DataStore.saveDonations(donations);
        loadDonationManagement();
    }
}

function deleteDonation(id) {
    if (confirm('Delete this donation?')) {
        DataStore.saveDonations(DataStore.getDonations().filter(d => d.id !== id));
        loadDonationManagement();
    }
}

function loadSystemStats() {
    const users = DataStore.getUsers();
    const claims = DataStore.getClaims();
    const approved = claims.filter(c => c.status === 'approved').length;
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('total-claims').textContent = claims.length;
    document.getElementById('approval-rate').textContent = claims.length > 0 ? `${((approved / claims.length) * 100).toFixed(1)}%` : '0%';
    document.getElementById('active-donors').textContent = users.filter(u => u.role === 'donor').length;
}

// === DEPARTMENTS ===
function loadDepartments() {
    const tbody = document.getElementById('dept-list');
    if (!tbody) return;
    const depts = DeptStore.get();
    tbody.innerHTML = depts.length === 0
        ? '<tr><td colspan="5" style="text-align:center; color:#95a5a6;">No departments added yet.</td></tr>'
        : depts.map(d => `
            <tr>
                <td>${d.id}</td>
                <td>${d.name}</td>
                <td>${d.hodNo}</td>
                <td>${d.clerkNo}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="editDept(${d.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDept(${d.id})">Delete</button>
                </td>
            </tr>
        `).join('');
}

function openAddDeptModal() {
    document.getElementById('modal-title').textContent = 'Add Department';
    document.getElementById('dept-form').reset();
    document.getElementById('dept-id').value = '';
    document.getElementById('dept-modal').style.display = 'flex';
}

function closeDeptModal() {
    document.getElementById('dept-modal').style.display = 'none';
}

document.getElementById('dept-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('dept-id').value;
    const name = document.getElementById('dept-name').value.trim();
    const hodNo = document.getElementById('dept-hod').value.trim();
    const clerkNo = document.getElementById('dept-clerk').value.trim();
    if (!name || !hodNo || !clerkNo) return alert('Fill all fields');

    const depts = DeptStore.get();
    if (id) {
        const idx = depts.findIndex(d => d.id == id);
        depts[idx] = { id: parseInt(id), name, hodNo, clerkNo };
    } else {
        depts.push({ id: Date.now(), name, hodNo, clerkNo });
    }
    DeptStore.save(depts);
    closeDeptModal();
    loadDepartments();
});

function editDept(id) {
    const dept = DeptStore.get().find(d => d.id == id);
    if (!dept) return;
    document.getElementById('modal-title').textContent = 'Edit Department';
    document.getElementById('dept-id').value = dept.id;
    document.getElementById('dept-name').value = dept.name;
    document.getElementById('dept-hod').value = dept.hodNo;
    document.getElementById('dept-clerk').value = dept.clerkNo;
    document.getElementById('dept-modal').style.display = 'flex';
}

function deleteDept(id) {
    if (confirm('Delete this department?')) {
        DeptStore.save(DeptStore.get().filter(d => d.id != id));
        loadDepartments();
    }
}

// === FILE DOWNLOAD ===
function downloadFile(name, type, base64) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

// === FIXED CLAIM DETAILS MODAL ===
function viewClaimDetails(claimId) {
    const claim = DataStore.getClaims().find(c => c.id === claimId);
    if (!claim) return alert('Claim not found');

    const modal = document.createElement('div');
    modal.id = 'claim-details-modal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:3000; padding:20px; backdrop-filter:blur(5px);';
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:16px; max-width:600px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 15px 40px rgba(0,0,0,0.2);">
            <h3 style="margin-bottom:20px; color:#2c3e50;">Claim #${claim.id} - Full Details</h3>
            <p><strong>Student:</strong> ${claim.claimerName}</p>
            <p><strong>Amount:</strong> PKR${claim.amount}</p>
            <p><strong>Department:</strong> ${claim.department}</p>
            <p><strong>Semester:</strong> ${claim.semester || '—'}</p>
            <p><strong>Description:</strong><br>${claim.description.replace(/\n/g, '<br>')}</p>
            ${claim.hodFile ? `<p><strong>HOD Document:</strong> <a href="#" onclick="event.preventDefault(); downloadFile('${claim.hodFile.name}', '${claim.hodFile.type}', '${claim.hodFile.data}')" style="color:#3498db; text-decoration:underline;">${claim.hodFile.name}</a></p>` : ''}
            ${claim.hodNo ? `<p><strong>HOD Contact:</strong> ${claim.hodNo}</p>` : ''}
            ${claim.adminOfficeNo ? `<p><strong>Easypasia NO:</strong> ${claim.adminOfficeNo}</p>` : ''}
            <p><strong>Submitted:</strong> ${new Date(claim.dateSubmitted).toLocaleString()}</p>
            <p><strong>Status:</strong> 
                <span style="padding:4px 10px; border-radius:6px; font-weight:600; 
                    background:${claim.status === 'approved' ? '#d4edda' : claim.status === 'rejected' ? '#f8d7da' : '#fff3cd'};
                    color:${claim.status === 'approved' ? '#155724' : claim.status === 'rejected' ? '#721c24' : '#856404'}">
                    ${claim.status}
                </span>
            </p>
            <button class="btn btn-secondary" style="margin-top:20px; width:100%; padding:12px;" 
                    onclick="document.getElementById('claim-details-modal')?.remove()">
                Close
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

// === ALERT ===
function showAlert(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

// === DOM LOADED ===
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    const admin = JSON.parse(localStorage.getItem('currentAdmin') || 'null');

    if (path === 'admin-login.html') {
        if (admin) window.location.href = 'admin.html';
        document.getElementById('admin-login-form')?.addEventListener('submit', handleAdminLogin);
    } else if (path === 'admin.html') {
        if (!admin) { window.location.href = 'admin-login.html'; return; }
        document.getElementById('admin-welcome').textContent = `Welcome, ${admin.email}`;
        document.getElementById('admin-dashboard').classList.remove('hidden');
        showAdminSection('pending-claims');
    }
});