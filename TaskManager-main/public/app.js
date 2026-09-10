
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

let currentFile = "master-task";

const table =
    document.getElementById("taskTable");

const modal =
    document.getElementById("taskModal");

const editModal =
    document.getElementById("editModal");

let currentEditId = null;

/* ============================================
   TOAST NOTIFICATION SYSTEM
   ============================================ */

function showToast(message, type = "success") {

    const container =
        document.getElementById("toastContainer");

    const toast =
        document.createElement("div");

    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="removeToast(this.parentElement)">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        removeToast(toast);
    }, 3000);
}

function removeToast(toast) {

    if (!toast || toast.classList.contains("removing")) {
        return;
    }

    toast.classList.add("removing");

    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 250);
}

/* ============================================
   CUSTOM CONFIRM DIALOG
   ============================================ */

function showConfirm(title, message) {

    return new Promise((resolve) => {

        const overlay =
            document.createElement("div");

        overlay.className = "confirm-modal";

        overlay.innerHTML = `
            <div class="confirm-content">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="btn-confirm-cancel">HỦY</button>
                    <button class="btn-confirm-delete">XÓA</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector(".btn-confirm-cancel")
            .onclick = () => {
                document.body.removeChild(overlay);
                resolve(false);
            };

        overlay.querySelector(".btn-confirm-delete")
            .onclick = () => {
                document.body.removeChild(overlay);
                resolve(true);
            };

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        });
    });
}

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

function formatDate(dateValue) {

    if (!dateValue) {
        return "";
    }

    const [year, month, day] =
        dateValue.split("-");

    return `${day}/${month}/${year}`;
}

function parseDeadline(deadline) {

    if (!deadline) {
        return null;
    }

    if (deadline.includes("/")) {

        const [day, month, year] =
            deadline.split("/");

        return new Date(
            year,
            month - 1,
            day
        );
    }

    if (deadline.includes("-")) {
        return new Date(deadline);
    }

    return null;
}

function getProgressColorClass(progress) {

    if (progress >= 75) return "progress-high";
    if (progress >= 40) return "progress-mid";
    return "progress-low";
}

function getStatusBadge(status) {

    if (status === "Done") {

        return `
        <span class="status done">
            Done
        </span>
        `;
    }

    if (status === "In Progress") {

        return `
        <span class="status progress">
            In Progress
        </span>
        `;
    }

    return `
    <span class="status pending">
        Pending
    </span>
    `;
}

function hideAllSections() {

    document
        .getElementById("taskSection")
        .classList.add("hidden");

    document
        .getElementById("reportSection")
        .classList.add("hidden");

    document
        .getElementById("progressSection")
        .classList.add("hidden");

    document
        .getElementById("logSection")
        .classList.add("hidden");
}

function showTaskSection() {

    hideAllSections();

    document
        .getElementById("taskSection")
        .classList.remove("hidden");
}

function getDeadlineStatus(deadline, status) {

    if (!deadline) {
        return "";
    }

    const today =
        new Date();

    today.setHours(
        0, 0, 0, 0
    );

    const due =
        parseDeadline(deadline);

    if (!due) {
        return "";
    }

    due.setHours(
        0, 0, 0, 0
    );

    const diff =
        Math.ceil(
            (due - today)
            /
            (1000 * 60 * 60 * 24)
        );

    if (
        diff < 0 &&
        status !== "Done"
    ) {

        return `
        <span class="deadline-overdue">
            Quá hạn
        </span>
        `;
    }

    if (
        diff <= 3 &&
        diff >= 0 &&
        status !== "Done"
    ) {

        return `
        <span class="deadline-warning">
            Còn ${diff} ngày
        </span>
        `;
    }

    return "";
}

/* ============================================
   DASHBOARD COUNTER ANIMATION
   ============================================ */

function animateCounter(element, target) {

    const duration = 400;
    const start = parseInt(element.innerText) || 0;
    const increment = target - start;
    const startTime = performance.now();

    function update(currentTime) {

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        element.innerText =
            Math.round(start + increment * eased);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/* ============================================
   LOAD & RENDER TASKS
   ============================================ */

async function loadTasks() {

    const response =
        await fetch(
            `/api/tasks/${currentFile}`
        );

    const data =
        await response.json();

    table.innerHTML = "";
    updateDashboard(
        data.tasks
    );

    if (data.tasks.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <h3>Chưa có task nào</h3>
                        <p>Nhấn "THÊM TASK" để tạo nhiệm vụ mới</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    data.tasks.forEach((task, index) => {

        const progressClass =
            getProgressColorClass(task.progress);

        const row = `
        <tr class="row-animate" style="animation-delay: ${index * 0.05}s">

            <td class="col-name">${task.taskName}</td>

            <td class="col-desc">${task.description}</td>

            <td class="col-deadline">
                ${task.deadline}
                ${getDeadlineStatus(
                    task.deadline,
                    task.status
                )}
            </td>

            <td class="col-progress">
                <div class="task-progress">
                    <div
                        class="task-progress-fill ${progressClass}"
                        style="width:${task.progress}%">
                    </div>
                </div>
                <div class="task-progress-text">${task.progress}%</div>
            </td>

            <td class="col-note">${task.note || ""}</td>

            <td class="col-status">${getStatusBadge(task.status)}</td>

            <td class="col-actions">
                <button
                    class="btn-edit"
                    onclick="editTask(${task.id})">
                    Sửa
                </button>
                <button
                    class="btn-danger"
                    onclick="deleteTask(${task.id})">
                    Xóa
                </button>
            </td>

        </tr>
        `;

        table.innerHTML += row;
    });
}

function updateDashboard(tasks) {

    animateCounter(
        document.getElementById("totalTasks"),
        tasks.length
    );

    animateCounter(
        document.getElementById("doneTasks"),
        tasks.filter(
            t => t.status === "Done"
        ).length
    );

    animateCounter(
        document.getElementById("doingTasks"),
        tasks.filter(
            t => t.status === "In Progress"
        ).length
    );

    animateCounter(
        document.getElementById("pendingTasks"),
        tasks.filter(
            t => t.status === "Pending"
        ).length
    );
}

/* ============================================
   TAB NAVIGATION
   ============================================ */

document
    .querySelectorAll(".tab")
    .forEach(btn => {

        btn.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".tab")
                    .forEach(t =>
                        t.classList.remove(
                            "active"
                        )
                    );

                btn.classList.add(
                    "active"
                );

                if (btn.dataset.file) {

                    currentFile =
                        btn.dataset.file;

                    showTaskSection();

                    loadTasks();
                }
            }
        );
    });

/* ============================================
   MODAL — Add Task
   ============================================ */

document
    .getElementById("addTaskBtn")
    .onclick = () => {

        modal.classList.remove(
            "hidden"
        );
    };

document
    .getElementById("closeModal")
    .onclick = () => {

        modal.classList.add(
            "hidden"
        );
    };

// Close modal on backdrop click
modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.classList.add("hidden");
    }
});

document
    .getElementById("saveTask")
    .onclick = async () => {

        const task = {

            taskName:
                document.getElementById(
                    "taskName"
                ).value,

            description:
                document.getElementById(
                    "description"
                ).value,

            deadline:
                formatDate(
                    document.getElementById(
                        "deadline"
                    ).value
                ),

            progress:
                Number(
                    document.getElementById(
                        "progress"
                    ).value
                ),

            note:
                document.getElementById(
                    "note"
                ).value,

            status:
                document.getElementById(
                    "status"
                ).value
        };

        if (
            task.progress < 0 ||
            task.progress > 100
        ) {
            showToast(
                "Tiến độ phải từ 0 đến 100%",
                "error"
            );
            return;
        }

        await fetch(
            `/api/tasks/${currentFile}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(task)
            }
        );

        modal.classList.add(
            "hidden"
        );

        showToast("Thêm task thành công");

        // Reset form
        document.getElementById("taskName").value = "";
        document.getElementById("description").value = "";
        document.getElementById("deadline").value = "";
        document.getElementById("progress").value = "";
        document.getElementById("note").value = "";
        document.getElementById("status").value = "Pending";
        document.getElementById("assignee").value = "";

        loadTasks();
    };

/* ============================================
   MODAL — Edit Task
   ============================================ */

document
    .getElementById("closeEditModal")
    .onclick = () => {

        editModal
            .classList.add(
                "hidden"
            );
    };

// Close edit modal on backdrop click
editModal.addEventListener("click", (e) => {
    if (e.target === editModal) {
        editModal.classList.add("hidden");
    }
});

document
    .getElementById(
        "updateTaskBtn"
    )
    .onclick =
    async () => {

        const progress =
            Number(
                document
                    .getElementById(
                        "editProgress"
                    )
                    .value
            );

        if (
            progress < 0 ||
            progress > 100
        ) {

            showToast(
                "Tiến độ phải từ 0 đến 100%",
                "error"
            );

            return;
        }

        await fetch(

            `/api/tasks/${currentFile}/${currentEditId}`,

            {

                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    taskName:
                        document
                            .getElementById(
                                "editTaskName"
                            )
                            .value,

                    description:
                        document
                            .getElementById(
                                "editDescription"
                            )
                            .value,

                    deadline:
                        formatDate(
                            document
                                .getElementById(
                                    "editDeadline"
                                )
                                .value
                        ),

                    progress,

                    note:
                        document
                            .getElementById(
                                "editNote"
                            )
                            .value,

                    status:
                        document
                            .getElementById(
                                "editStatus"
                            )
                            .value
                })
            }
        );

        editModal
            .classList.add(
                "hidden"
            );

        showToast("Cập nhật task thành công");

        loadTasks();
    };

/* ============================================
   TASK ACTIONS
   ============================================ */

async function deleteTask(id) {

    const confirmed =
        await showConfirm(
            "Xóa Task",
            "Bạn có chắc muốn xóa task này? Hành động này không thể hoàn tác."
        );

    if (!confirmed) {
        return;
    }

    await fetch(
        `/api/tasks/${currentFile}/${id}`,
        {
            method: "DELETE"
        }
    );

    showToast("Đã xóa task", "error");

    loadTasks();
}

async function editTask(id) {

    const response =
        await fetch(
            `/api/tasks/${currentFile}`
        );

    const data =
        await response.json();

    const task =
        data.tasks.find(
            t => t.id === id
        );

    if (!task) {
        return;
    }

    currentEditId = id;

    document
        .getElementById(
            "editTaskName"
        ).value =
        task.taskName;

    document
        .getElementById(
            "editDescription"
        ).value =
        task.description;

    const parts =
        task.deadline.split("/");

    document
        .getElementById(
            "editDeadline"
        ).value =
        `${parts[2]}-${parts[1]}-${parts[0]}`;

    document
        .getElementById(
            "editProgress"
        ).value =
        task.progress;

    document
        .getElementById(
            "editNote"
        ).value =
        task.note || "";

    document
        .getElementById(
            "editStatus"
        ).value =
        task.status;

    editModal
        .classList.remove(
            "hidden"
        );
}

/* ============================================
   TOOLBAR ACTIONS
   ============================================ */

document
    .getElementById("refreshBtn")
    .onclick = () => {
        loadTasks();
        showToast("Đã làm mới dữ liệu");
    };

document
    .getElementById("syncBtn")
    .onclick =
    async () => {

        const response =
            await fetch(
                "/api/sync",
                {
                    method: "POST"
                }
            );

        const data =
            await response.json();

        if (data.success) {
            showToast("Đồng bộ thành công");
        }
        else {
            showToast("Lỗi đồng bộ", "error");
        }
    };

document
    .getElementById("exportBtn")
    .onclick = () => {

        window.location.href =
            "/api/export/excel/" + currentSubject;
    };

if (document.getElementById("exportMdBtn")) {
    document.getElementById("exportMdBtn").onclick = () => {
        window.location.href = "/api/export/md/" + currentSubject;
    };
}

document
    .getElementById("importBtn")
    .onclick = () => {

        document
            .getElementById("jsonFile")
            .click();
    };

document
    .getElementById("jsonFile")
    .addEventListener(
        "change",
        async (event) => {

            const file =
                event.target.files[0];

            if (!file) {
                return;
            }

            const text =
                await file.text();

            const json =
                JSON.parse(text);

            const response =
                await fetch(
                    "/api/import/" + currentSubject,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(json)
                    }
                );

            const result =
                await response.json();

            if (result.success) {

                showToast(
                    "Import thành công"
                );

                loadTasks();
            }
            else {

                showToast(
                    "Import thất bại",
                    "error"
                );
            }

            event.target.value = "";
        }
    );

/* ============================================
   SPECIAL TABS
   ============================================ */

document
    .getElementById("reportTab")
    .onclick =
    () => {
        setActiveTab("reportTab");
        loadReports();
    };

document
    .getElementById("progressTab")
    .onclick =
    () => {
        setActiveTab("progressTab");
        loadProgress();
    };

document
    .getElementById("logTab")
    .onclick =
    () => {
        setActiveTab("logTab");
        loadLogs();
    };

/* ============================================
   REPORTS
   ============================================ */

async function loadReports() {

    hideAllSections();

    document
        .getElementById("reportSection")
        .classList.remove("hidden");

    const response =
        await fetch(
            "/api/reports/" + currentSubject
        );

    const data =
        await response.json();

    const reportList =
        document.getElementById(
            "reportList"
        );

    reportList.innerHTML = "";

    const reports = data.reports || [];

    if (reports.length === 0) {
        reportList.innerHTML = `
            <div class="empty-state">
                <h3>Chưa có báo cáo nào</h3>
                <p>Gửi báo cáo đầu tiên của bạn</p>
            </div>
        `;
        return;
    }

    reports.forEach((report, index) => {

        reportList.innerHTML += `
        <div class="log-item card-animate" style="animation-delay: ${index * 0.05}s">
            <b>${report.user}</b>
            <br>
            ${report.content}
            <br>
            <small>${report.createdAt}</small>
        </div>
        `;
    });
}

document
    .getElementById("submitReport")
    .onclick =
    async () => {

        const user =
            document
                .getElementById(
                    "reportUser"
                )
                .value;

        const content =
            document
                .getElementById(
                    "reportContent"
                )
                .value;

        if (!user || !content) {
            showToast("Vui lòng điền đầy đủ thông tin", "error");
            return;
        }

        await fetch(
            "/api/reports/" + currentSubject,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    user,
                    content
                })
            }
        );

        showToast("Đã gửi báo cáo");

        document.getElementById("reportUser").value = "";
        document.getElementById("reportContent").value = "";

        loadReports();
    };

/* ============================================
   PROGRESS
   ============================================ */

async function loadProgress() {

    hideAllSections();

    document
        .getElementById("progressSection")
        .classList.remove("hidden");

    const response =
        await fetch(
            "/api/progress/" + currentSubject
        );

    const data =
        await response.json();

    const container =
        document.getElementById(
            "progressContainer"
        );

    container.innerHTML = "";

    data.forEach((user, index) => {

        const progressClass =
            getProgressColorClass(user.progress);

        container.innerHTML += `
        <div class="progress-row card-animate" style="animation-delay: ${index * 0.05}s">

            <div class="progress-label">
                ${user.user}
            </div>

            <div class="progress-bar">
                <div
                    class="progress-fill ${progressClass}"
                    style="width:${user.progress}%">
                </div>
            </div>

            <div class="progress-percent">${user.progress}%</div>

        </div>
        `;
    });
}

/* ============================================
   ACTIVITY LOGS
   ============================================ */

async function loadLogs() {

    hideAllSections();

    document
        .getElementById("logSection")
        .classList.remove("hidden");

    const response =
        await fetch(
            "/api/logs/" + currentSubject
        );

    const data =
        await response.json();

    const container =
        document.getElementById(
            "activityLog"
        );

    container.innerHTML = "";

    const logs = data.logs || [];

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Chưa có hoạt động nào</h3>
                <p>Nhật ký sẽ tự động ghi khi có thay đổi</p>
            </div>
        `;
        return;
    }

    logs.forEach((log, index) => {

        container.innerHTML += `
        <div class="log-item card-animate" style="animation-delay: ${index * 0.03}s">
            <b>${log.user}</b>
            -
            ${log.action}
            -
            ${log.taskName}
            <br>
            <small>${log.time}</small>
        </div>
        `;
    });
}

/* ============================================
   HELPERS
   ============================================ */

function setActiveTab(tabId) {

    document
        .querySelectorAll(".tab")
        .forEach(tab =>
            tab.classList.remove("active")
        );

    document
        .getElementById(tabId)
        .classList.add("active");
}

/* ============================================
   AUTO-REFRESH
   ============================================ */

setInterval(() => {

    if (
        !document
            .getElementById("taskSection")
            .classList.contains("hidden")
    ) {

        loadTasks();
    }

}, 30000);

/* ============================================
   INIT
   ============================================ */

loadSubjects().then(() => { loadTasks(); });