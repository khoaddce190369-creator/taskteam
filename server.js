const ExcelJS = require("exceljs");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");

// Create data dir if not exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Migration: Move top-level JSON files into "Default" subject
const topLevelFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
if (topLevelFiles.length > 0) {
    const defaultDir = path.join(DATA_DIR, "Default");
    if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
    }
    for (const file of topLevelFiles) {
        fs.renameSync(path.join(DATA_DIR, file), path.join(defaultDir, file));
    }
    console.log("Migrated existing JSON files to Default subject.");
}

const USERS = [
    "master-task",
    "khoa",
    "thai",
    "nhannghia",
    "trong",
    "doannghia"
];

function parseDeadline(deadline) {
    const parts = deadline.split("/");
    if (parts.length !== 3) {
        return new Date(deadline);
    }
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function getFile(subject, name) {
    // Sanitize subject to prevent directory traversal
    const safeSubject = subject.replace(/[^a-zA-Z0-9_\-\sàáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳỵỷỹýÀÁÃẠẢĂẮẰẲẴẶÂẤẦẨẪẬÈÉẸẺẼÊỀẾỂỄỆĐÌÍĨỈỊÒÓÕỌỎÔỐỒỔỖỘƠỚỜỞỠỢÙÚŨỤỦƯỨỪỬỮỰỲỴỶỸÝ]/g, "");
    const dir = path.join(DATA_DIR, safeSubject);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, `${name}.json`);
}

function readJson(subject, name) {
    const file = getFile(subject, name);
    if (!fs.existsSync(file)) {
        return { tasks: [] }; // Default empty structure
    }
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        return { tasks: [] };
    }
}

function writeJson(subject, name, data) {
    fs.writeFileSync(getFile(subject, name), JSON.stringify(data, null, 4));
}

function addLog(subject, user, action, taskName = "") {
    const logs = readJson(subject, "activity-log");
    if (!logs.logs) {
        logs.logs = [];
    }
    logs.logs.unshift({
        id: Date.now(),
        user,
        action,
        taskName,
        time: new Date().toLocaleString("vi-VN")
    });
    writeJson(subject, "activity-log", logs);
}

// --- SUBJECTS API ---
app.get("/api/subjects", (req, res) => {
    const subjects = fs.readdirSync(DATA_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    // Ensure "Default" exists if empty
    if (subjects.length === 0) {
        const defaultDir = path.join(DATA_DIR, "Default");
        fs.mkdirSync(defaultDir, { recursive: true });
        subjects.push("Default");
    }
    res.json({ success: true, subjects });
});

app.post("/api/subjects", (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === "") return res.json({ success: false });
    const safeSubject = name.trim().replace(/[^a-zA-Z0-9_\-\sàáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳỵỷỹýÀÁÃẠẢĂẮẰẲẴẶÂẤẦẨẪẬÈÉẸẺẼÊỀẾỂỄỆĐÌÍĨỈỊÒÓÕỌỎÔỐỒỔỖỘƠỚỜỞỠỢÙÚŨỤỦƯỨỪỬỮỰỲỴỶỸÝ]/g, "");
    const dir = path.join(DATA_DIR, safeSubject);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    res.json({ success: true, subject: safeSubject });
});

// --- TASKS API ---
app.get("/api/tasks/:subject/:user", (req, res) => {
    res.json(readJson(req.params.subject, req.params.user));
});

app.post("/api/tasks/:subject/:user", (req, res) => {
    const { subject, user } = req.params;
    const data = readJson(subject, user);
    const task = req.body;

    task.id = Date.now();
    task.createdAt = new Date().toISOString();
    task.progress = Math.max(0, Math.min(100, task.progress || 0));

    if (!data.tasks) data.tasks = [];
    data.tasks.push(task);
    
    writeJson(subject, user, data);
    addLog(subject, user, "CREATE", task.taskName);
    res.json({ success: true });
});

app.put("/api/tasks/:subject/:user/:id", (req, res) => {
    const { subject, user } = req.params;
    const id = Number(req.params.id);
    const data = readJson(subject, user);
    if (!data.tasks) data.tasks = [];
    
    const task = data.tasks.find(t => t.id === id);
    if (!task) return res.status(404).json({ success: false });

    Object.assign(task, req.body);
    task.progress = Math.max(0, Math.min(100, task.progress || 0));

    writeJson(subject, user, data);
    addLog(subject, user, "UPDATE", task.taskName);
    res.json({ success: true });
});

app.delete("/api/tasks/:subject/:user/:id", (req, res) => {
    const { subject, user } = req.params;
    const id = Number(req.params.id);
    const data = readJson(subject, user);
    if (!data.tasks) data.tasks = [];
    
    const task = data.tasks.find(t => t.id === id);
    data.tasks = data.tasks.filter(t => t.id !== id);

    writeJson(subject, user, data);
    addLog(subject, user, "DELETE", task?.taskName || "");
    res.json({ success: true });
});

// --- REPORTS API ---
app.get("/api/reports/:subject", (req, res) => {
    res.json(readJson(req.params.subject, "reports"));
});

app.post("/api/reports/:subject", (req, res) => {
    const { subject } = req.params;
    const reports = readJson(subject, "reports");
    if (!reports.reports) reports.reports = [];
    
    reports.reports.unshift({
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toLocaleString("vi-VN")
    });
    
    writeJson(subject, "reports", reports);
    res.json({ success: true });
});

// --- PROGRESS API ---
app.get("/api/progress/:subject", (req, res) => {
    const subject = req.params.subject;
    const result = [];
    
    USERS.filter(u => u !== "master-task").forEach(user => {
        const data = readJson(subject, user);
        if (!data.tasks || data.tasks.length === 0) {
            result.push({ user, progress: 0 });
            return;
        }
        const avg = data.tasks.reduce((a, b) => a + (b.progress || 0), 0) / data.tasks.length;
        result.push({ user, progress: Math.round(avg) });
    });
    res.json(result);
});

// --- LOGS API ---
app.get("/api/logs/:subject", (req, res) => {
    res.json(readJson(req.params.subject, "activity-log"));
});

// --- GITHUB SYNC API ---
app.post("/api/sync", (req, res) => {
    exec('git add . && git commit -m "Auto Sync" && git push origin main', { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) return res.json({ success: false, error: error.message });
        res.json({ success: true, output: stdout });
    });
});

// --- IMPORT API ---
app.post("/api/import/:subject", (req, res) => {
    const subject = req.params.subject;
    const importData = req.body;
    if (!Array.isArray(importData)) return res.json({ success: false });

    let imported = 0;
    importData.forEach(group => {
        const target = group.target;
        const data = readJson(subject, target);
        if (!data.tasks) data.tasks = [];
        
        (group.tasks || []).forEach(task => {
            task.id = Date.now() + Math.floor(Math.random() * 10000);
            task.createdAt = new Date().toISOString();
            data.tasks.push(task);
            imported++;
        });
        writeJson(subject, target, data);
    });

    addLog(subject, "SYSTEM", "IMPORT JSON", `${imported} task`);
    res.json({ success: true, imported });
});

// --- EXPORT API ---
app.get("/api/export/excel/:subject", async (req, res) => {
    const subject = req.params.subject;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ALL TASKS");

    sheet.columns = [
        { header: "Nhóm", key: "group", width: 15 },
        { header: "Tên Task", key: "taskName", width: 35 },
        { header: "Người thực hiện", key: "assignee", width: 20 },
        { header: "Nội dung", key: "description", width: 60 },
        { header: "Deadline", key: "deadline", width: 15 },
        { header: "Tiến độ", key: "progress", width: 15 },
        { header: "Ghi chú", key: "note", width: 40 },
        { header: "Trạng thái", key: "status", width: 18 }
    ];

    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell(cell => {
        cell.font = { name: "Arial", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B5394" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    let colorIndex = 0;
    let currentDeadline = null;

    USERS.forEach(user => {
        const data = readJson(subject, user);
        const groupNames = {
            "master-task": "Nhiệm vụ tổng",
            "khoa": "Khoa",
            "thai": "Thái",
            "nhannghia": "Nhân Nghĩa",
            "trong": "Trọng",
            "doannghia": "Đoàn Nghĩa"
        };

        (data.tasks || []).forEach(task => {
            if (task.deadline !== currentDeadline) {
                currentDeadline = task.deadline;
                colorIndex++;
            }

            const rowColor = colorIndex % 2 === 0 ? "FFCFE2F3" : "FFEFEFEF";
            const row = sheet.addRow({
                group: groupNames[user] || user,
                taskName: task.taskName,
                assignee: task.assignee || "",
                description: task.description,
                deadline: task.deadline,
                progress: `${task.progress}%`,
                note: task.note,
                status: task.status
            });

            row.eachCell(cell => {
                cell.font = { name: "Arial", size: 13 };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowColor } };
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                cell.alignment = { vertical: "middle", wrapText: true };
                if (cell.col === 5 || cell.col === 6 || cell.col === 8) {
                    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                }
            });
        });
    });

    sheet.autoFilter = { from: "A1", to: "H1" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=TeamTask_${subject}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

app.get("/api/export/md/:subject", (req, res) => {
    const subject = req.params.subject;
    let mdContent = `# BẢNG PHÂN CÔNG NHIỆM VỤ - ${subject}\n\n`;

    const groupNames = {
        "master-task": "Nhiệm vụ tổng",
        "khoa": "Khoa",
        "thai": "Thái",
        "nhannghia": "Nhân Nghĩa",
        "trong": "Trọng",
        "doannghia": "Đoàn Nghĩa"
    };

    USERS.forEach(user => {
        const data = readJson(subject, user);
        if (!data.tasks || data.tasks.length === 0) return;

        mdContent += `## ${groupNames[user] || user}\n\n`;
        
        data.tasks.forEach((task, index) => {
            mdContent += `### ${index + 1}. ${task.taskName}\n`;
            if (task.assignee) mdContent += `- **Người thực hiện:** ${task.assignee}\n`;
            mdContent += `- **Trạng thái:** ${task.status} (${task.progress}%)\n`;
            mdContent += `- **Deadline:** ${task.deadline}\n`;
            mdContent += `- **Nội dung:** ${task.description}\n`;
            if (task.note) mdContent += `- **Ghi chú:** ${task.note}\n`;
            mdContent += `\n`;
        });
        mdContent += `---\n\n`;
    });

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=TeamTask_${subject}.md`);
    res.send(mdContent);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});