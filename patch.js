const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Add currentSubject variable and initialization logic
const initLogic = `
let currentSubject = 'Default';

async function loadSubjects() {
    const res = await fetch('/api/subjects');
    const data = await res.json();
    const select = document.getElementById('subjectSelect');
    select.innerHTML = '';
    data.subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        select.appendChild(opt);
    });
    
    if (data.subjects.length > 0) {
        currentSubject = data.subjects[0];
        select.value = currentSubject;
    }

    select.addEventListener('change', (e) => {
        currentSubject = e.target.value;
        if (!document.getElementById('taskSection').classList.contains('hidden')) {
            loadTasks();
        } else if (!document.getElementById('reportSection').classList.contains('hidden')) {
            loadReports();
        } else if (!document.getElementById('progressSection').classList.contains('hidden')) {
            loadProgress();
        } else if (!document.getElementById('logSection').classList.contains('hidden')) {
            loadLogs();
        }
    });

    const addBtn = document.getElementById('addSubjectBtn');
    if (addBtn) {
        addBtn.onclick = async () => {
            const name = prompt('Nhập tên môn học mới:');
            if (!name) return;
            const res = await fetch('/api/subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const result = await res.json();
            if (result.success) {
                await loadSubjects();
                select.value = result.subject;
                select.dispatchEvent(new Event('change'));
            }
        };
    }
}
`;

code = code.replace('let currentFile = "master-task";', initLogic + '\nlet currentFile = "master-task";');

// 2. Replace API endpoints
code = code.replace(/"\/api\/tasks\/"\s*\+\s*currentFile/g, '"/api/tasks/" + currentSubject + "/" + currentFile');
code = code.replace(/"\/api\/reports"/g, '"/api/reports/" + currentSubject');
code = code.replace(/"\/api\/progress"/g, '"/api/progress/" + currentSubject');
code = code.replace(/"\/api\/logs"/g, '"/api/logs/" + currentSubject');
code = code.replace(/"\/api\/import"/g, '"/api/import/" + currentSubject');
code = code.replace(/"\/api\/export\/excel"/g, '"/api/export/excel/" + currentSubject');
code = code.replace(/"\/api\/export\/md"/g, '"/api/export/md/" + currentSubject');

// 3. Update initialization
// We only want to replace the LAST loadTasks();
const lastIndex = code.lastIndexOf('loadTasks();');
if (lastIndex !== -1) {
    code = code.substring(0, lastIndex) + 'loadSubjects().then(() => { loadTasks(); });' + code.substring(lastIndex + 'loadTasks();'.length);
}

fs.writeFileSync('public/app.js', code);
console.log('Patched app.js successfully');
