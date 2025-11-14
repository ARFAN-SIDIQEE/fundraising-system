// === SECURE SHA-256 HASHING ===
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// === DATASTORE ===
const DataStore = {
    init() {
        if (!localStorage.getItem('users')) localStorage.setItem('users', JSON.stringify([]));
        if (!localStorage.getItem('claims')) localStorage.setItem('claims', JSON.stringify([]));
        if (!localStorage.getItem('admins')) {
            const defaultHash = 'f865b53623b121fd34ee5426c792e5c33af8c2271169292f8d0d6d5eaca2d9f9'; // admin123
            localStorage.setItem('admins', JSON.stringify([
                { id: 1, name: "Admin", email: "admin@fundraising.com", password: defaultHash }
            ]));
        }
        if (!localStorage.getItem('messages')) localStorage.setItem('messages', JSON.stringify([]));
        if (!localStorage.getItem('donations')) localStorage.setItem('donations', JSON.stringify([]));
    },
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
DataStore.init();

// === NAVIGATION ===
function showSection(sectionId) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
    updateNavLinks();
}

function updateNavLinks() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    if (loginLink && registerLink) {
        if (currentUser) {
            loginLink.textContent = 'Logout';
            loginLink.onclick = logout;
            registerLink.classList.add('hidden');
        } else {
            loginLink.textContent = 'Login';
            loginLink.onclick = () => showSection('login');
            registerLink.classList.remove('hidden');
        }
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    showSection('home');
    updateNavLinks();
}

// === AUTH ===
async function loginUser(email, password) {
    const users = DataStore.getUsers();
    const hashedInput = await hashPassword(password);
    return users.find(u => u.email === email && u.password === hashedInput);
}

// === REGISTRATION (FIXED) ===
async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;

    if (!name || !email || !password || !role) {
        showAlert('register-alert', 'All fields are required!', 'danger');
        return;
    }

    if (password.length < 6) {
        showAlert('register-alert', 'Password must be 6+ characters!', 'danger');
        return;
    }

    const users = DataStore.getUsers();
    if (users.some(u => u.email === email)) {
        showAlert('register-alert', 'Email already registered!', 'danger');
        return;
    }

    let hashedPassword;
    try {
        hashedPassword = await hashPassword(password);
    } catch (err) {
        showAlert('register-alert', 'Registration failed!', 'danger');
        return;
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password: hashedPassword,
        role,
        registrationDate: new Date().toISOString()
    };

    users.push(newUser);
    DataStore.saveUsers(users);

    showAlert('register-alert', 'Registered successfully!', 'success');
    document.getElementById('register-form').reset();

    localStorage.setItem('currentUser', JSON.stringify(newUser));
    setTimeout(() => {
        if (role === 'claimer') {
            showSection('claimer-dashboard');
            loadClaimerData();
        } else if (role === 'donor') {
            showSection('donor-dashboard');
            loadDonorData();
        }
    }, 1500);
}

// === LOGIN ===
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const role = document.getElementById('login-role').value;

    const user = await loginUser(email, password);
    if (user && user.role === role) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        showAlert('login-alert', 'Login successful!', 'success');
        setTimeout(() => {
            if (role === 'claimer') {
                showSection('claimer-dashboard');
                loadClaimerData();
            } else if (role === 'donor') {
                showSection('donor-dashboard');
                loadDonorData();
            }
        }, 1000);
    } else {
        showAlert('login-alert', 'Invalid email, password, or role!', 'danger');
    }
}

// === CLAIMER DASHBOARD ===
function showClaimerSection(section) {
    ['submit-claim', 'my-claims', 'messages'].forEach(sec => {
        const el = document.getElementById(`${sec}-section`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`${section}-section`);
    if (target) target.classList.remove('hidden');
    if (section === 'my-claims') loadClaimerClaims();
    else if (section === 'messages') loadClaimerMessages();
}

function loadClaimerData() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user) document.getElementById('claim-name').value = user.name;
    loadClaimerClaims();
    loadClaimerMessages();
}

function loadClaimerMessages() {
    const container = document.getElementById('claimer-messages');
    if (!container) return;
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    const regDate = new Date(user.registrationDate);
    const messages = DataStore.getMessages().filter(m => {
        const msgDate = new Date(m.dateSent);
        return (m.recipient === 'all' || m.recipient === 'claimers') && msgDate >= regDate;
    });

    container.innerHTML = messages.length === 0
        ? `<div class="no-messages"><span class="no-messages-icon">Inbox</span><h4>No Messages</h4></div>`
        : messages.map(m => `
            <div class="message-card">
                <div class="message-header">
                    <span class="message-sender">Admin</span>
                    <span class="message-date">${new Date(m.dateSent).toLocaleString()}</span>
                </div>
                <div class="message-subject">${m.subject}</div>
                <div class="message-content">${m.content.replace(/\n/g, '<br>')}</div>
            </div>
        `).join('');
}

function loadClaimerClaims() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    const claims = DataStore.getClaims().filter(c => c.claimerId === user.id);
    const tbody = document.getElementById('claimer-claims-list');
    if (!tbody) return;
    tbody.innerHTML = claims.length === 0
        ? '<tr><td colspan="6" style="text-align:center; padding:40px;">No claims yet.</td></tr>'
        : claims.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>PKR${c.amount}</td>
                <td>${c.department}</td>
                <td>${c.semester || '-'}</td>
                <td>${new Date(c.dateSubmitted).toLocaleDateString()}</td>
                <td><span class="status-${c.status}">${c.status}</span></td>
            </tr>
        `).join('');
}

async function handleClaimSubmit(e) {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    const amount = document.getElementById('claim-amount').value;
    const department = document.getElementById('claim-department').value.trim();
    const semester = document.getElementById('claim-semester').value;
    const description = document.getElementById('claim-description').value.trim();
    const hodFileInput = document.getElementById('hod-file');
    const hodNo = document.getElementById('hod-no').value.trim();
    const adminOfficeNo = document.getElementById('admin-office-no').value.trim();

    if (!amount || !department || !semester || !description) {
        showAlert('claimer-alert', 'Fill all required fields!', 'danger');
        return;
    }

    let hodFileData = null;
    if (hodFileInput?.files[0]) {
        const file = hodFileInput.files[0];
        hodFileData = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => {
                const base64 = e.target.result.split(',')[1];
                resolve({ name: file.name, type: file.type, data: base64 });
            };
            reader.readAsDataURL(file);
        });
    }

    const claims = DataStore.getClaims();
    claims.push({
        id: Date.now(),
        claimerId: user.id,
        claimerName: user.name,
        amount: parseFloat(amount),
        department,
        semester,
        description,
        hodFile: hodFileData,
        hodNo,
        adminOfficeNo,
        dateSubmitted: new Date().toISOString(),
        status: 'pending'
    });
    DataStore.saveClaims(claims);
    showAlert('claimer-alert', 'Claim submitted!', 'success');
    document.getElementById('claim-form').reset();
    document.getElementById('claim-name').value = user.name;
    loadClaimerData();
}

// === DONOR DASHBOARD ===
function showDonorSection(section) {
    ['approved-claims', 'my-donations', 'messages', 'donate'].forEach(sec => {
        const el = document.getElementById(`${sec}-section`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`${section}-section`);
    if (target) target.classList.remove('hidden');

    if (section === 'approved-claims') loadApprovedClaims();
    else if (section === 'my-donations') loadDonations();
    else if (section === 'messages') loadDonorMessages();
    else if (section === 'donate') loadDonationPage();
}

function loadDonorData() {
    loadApprovedClaims();
    loadDonations();
    loadDonorMessages();
}

function loadApprovedClaims() {
    const container = document.getElementById('approved-claims-list');
    if (!container) return;
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    const donations = DataStore.getDonations();
    const donatedClaimIds = donations
        .filter(d => d.donorId === user.id && d.status !== 'rejected')
        .map(d => d.claimId);

    const approvedClaims = DataStore.getClaims().filter(c => c.status === 'approved');

    container.innerHTML = approvedClaims.length === 0
        ? `<div class="no-claims"><h4>No Approved Claims</h4></div>`
        : approvedClaims.map(claim => {
            const hasDonated = donatedClaimIds.includes(claim.id);
            return `
                <div class="approved-claim-item">
                    <div class="claim-header"><strong>${claim.claimerName}</strong> – ${claim.department}</div>
                    <div class="claim-body">
                        <p><strong>Amount:</strong> PKR${claim.amount}</p>
                        <p><strong>Description:</strong> ${claim.description}</p>
                    </div>
                    <div class="claim-actions">
                        ${hasDonated
                    ? `<div class="donated-badge">You Donated</div>`
                    : `<button class="btn btn-primary btn-sm" onclick="showDonationPage(${claim.id})">Donate</button>`
                }
                    </div>
                </div>
            `;
        }).join('');
}

function loadDonorMessages() {
    const container = document.getElementById('donor-messages');
    if (!container) return;

    const messages = DataStore.getMessages().filter(m =>
        m.recipient === 'all' || m.recipient === 'donors'
    );

    container.innerHTML = messages.length === 0
        ? `<div class="no-messages"><h4>No Messages</h4></div>`
        : messages.map(m => `
            <div class="message-card">
                <div class="message-header">
                    <span class="message-sender">Admin</span>
                    <span class="message-date">${new Date(m.dateSent).toLocaleString()}</span>
                </div>
                <div class="message-subject">${m.subject}</div>
                <div class="message-content">${m.content.replace(/\n/g, '<br>')}</div>
            </div>
        `).join('');
}

function loadDonations() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    const donations = DataStore.getDonations().filter(d => d.donorId === user.id);
    const total = donations.reduce((s, d) => s + d.amount, 0);
    document.getElementById('total-donated-amount').textContent = `PKR${total}`;
    document.getElementById('total-donations-count').textContent = donations.length;

    const tbody = document.getElementById('donations-list');
    if (!tbody) return;
    tbody.innerHTML = donations.length === 0
        ? `<tr><td colspan="7" style="text-align:center; padding:40px;">No donations yet.</td></tr>`
        : donations.map(d => {
            const claim = DataStore.getClaims().find(c => c.id === d.claimId);
            return `<tr>
                <td>${d.id}</td>
                <td>${claim ? claim.claimerName : '—'}</td>
                <td>PKR${d.amount}</td>
                <td>${d.paymentMethod}</td>
                <td>${d.transactionId}</td>
                <td><span class="status-${d.status}">${d.status}</span></td>
                <td>${new Date(d.date).toLocaleDateString()}</td>
            </tr>`;
        }).join('');
}

function showDonationPage(claimId) {
    const claim = DataStore.getClaims().find(c => c.id === claimId);
    if (!claim) return alert('Claim not found');
    localStorage.setItem('currentDonationClaim', JSON.stringify(claim));
    showDonorSection('donate');
}

function loadDonationPage() {
    const container = document.getElementById('donate-section');
    const claim = JSON.parse(localStorage.getItem('currentDonationClaim') || 'null');
    if (!claim) {
        container.innerHTML = `<div class="no-claim-selected"><h3>No Claim Selected</h3><button class="btn btn-primary" onclick="showDonorSection('approved-claims')">Browse</button></div>`;
        return;
    }
    container.innerHTML = `
        <div class="donation-header">
            <h3>Donate to ${claim.claimerName}</h3>
            <p><strong>Amount:</strong> PKR${claim.amount}</p>
            <p>${claim.description}</p>
        </div>
        <div class="payment-details">
            <h4>EasyPaisa</h4>
            <p><strong>Name:</strong> Arfan Sidiqee</p>
            <p><strong>Number:</strong> 03330510899</p>
            <input type="number" id="donation-amount" class="form-control" min="100" value="${claim.amount}" placeholder="Amount">
            <input type="text" id="transaction-id" class="form-control" placeholder="Transaction ID">
            <input type="date" id="payment-date" class="form-control">
            <button class="btn btn-success btn-lg" onclick="submitDonation()" style="width:100%; margin-top:15px;">Confirm</button>
        </div>
    `;
    document.getElementById('payment-date').valueAsDate = new Date();
}

function submitDonation() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const claim = JSON.parse(localStorage.getItem('currentDonationClaim'));
    const amount = document.getElementById('donation-amount').value;
    const tid = document.getElementById('transaction-id').value.trim();
    const date = document.getElementById('payment-date').value;

    if (!amount || !tid || !date || parseFloat(amount) < 100) {
        alert('Invalid details');
        return;
    }

    const donations = DataStore.getDonations();
    donations.push({
        id: Date.now(),
        claimId: claim.id,
        donorId: user.id,
        donorName: user.name,
        amount: parseFloat(amount),
        paymentMethod: 'EasyPaisa',
        transactionId: tid,
        paymentDate: date,
        status: 'pending',
        date: new Date().toISOString()
    });
    DataStore.saveDonations(donations);
    localStorage.removeItem('currentDonationClaim');
    document.getElementById('donate-section').innerHTML = `
        <div class="donation-success">
            <h4>Thank You!</h4>
            <p>Donation of PKR${amount} submitted.</p>
            <button class="btn btn-primary" onclick="showDonorSection('my-donations')">View</button>
        </div>
    `;
}

function showAlert(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('claim-form')?.addEventListener('submit', handleClaimSubmit);

    updateNavLinks();
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (user) {
        if (user.role === 'claimer') {
            showSection('claimer-dashboard');
            loadClaimerData();
        } else if (user.role === 'donor') {
            showSection('donor-dashboard');
            loadDonorData();
        }
    }
});