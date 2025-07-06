// =================================================================================
// --- 設定 (Settings) ---
// =================================================================================

const API_URL_BASE = "https://shift-app-api-xgls.onrender.com";

// APIエンドポイント
const GET_DATA_URL = `${API_URL_BASE}/api/shift-data`;
const ADD_SHIFT_URL = `${API_URL_BASE}/api/shifts/add`;
const UPDATE_SHIFT_URL_TEMPLATE = `${API_URL_BASE}/api/shifts/update/`;
const DELETE_SHIFT_URL_TEMPLATE = `${API_URL_BASE}/api/shifts/delete/`;
const ADD_STAFF_URL = `${API_URL_BASE}/api/staff/add`;
const UPDATE_STAFF_URL_TEMPLATE = `${API_URL_BASE}/api/staff/update/`;
const DELETE_STAFF_URL_TEMPLATE = `${API_URL_BASE}/api/staff/delete/`;
const UPDATE_STAFF_AVAILABILITIES_URL_TEMPLATE = `${API_URL_BASE}/api/staff/availabilities/update/`;

// シフト定義
const SHIFT_DEFINITIONS = {
    "早": { type: 'day_work', hours: 8 }, "日1": { type: 'day_work', hours: 8 }, "日2": { type: 'day_work', hours: 8 },
    "中": { type: 'day_work', hours: 8 }, "遅": { type: 'day_work', hours: 8 }, "夜": { type: 'night_work', hours: 16 },
    "明": { type: 'day_work', hours: 0 }, "休": { type: 'holiday', hours: 0 }, "有": { type: 'paid_holiday', hours: 0 }
};

// 集計表の表示順
const SUMMARY_ORDER = ["早", "日1", "日2", "中", "遅", "夜", "明", "日勤時間数", "夜勤時間数", "休", "有"];
const DAILY_COUNT_TARGETS = ["早", "日1", "日2", "中", "遅", "夜"];


// =================================================================================
// --- 状態管理 (State Management) ---
// =================================================================================

let currentDate = new Date();
let isAccordionOpen = false;
let currentShifts = [];
let currentStaff = [];
let requiredStaffing = {}; // 日ごとの必要人数 { "YYYY-MM-DD": { "早": 2 } }
let globalTargetHolidays = { '休': 8, '有': 0 }; // 全員共通の目標休日数
let staffTargetHolidays = {}; // スタッフ個別の目標休日数（上書き用）


// =================================================================================
// --- DOM要素 (DOM Elements) ---
// =================================================================================

let calendarTitle, prevMonthBtn, nextMonthBtn, todayBtn, tableHeader, tableBody, tableFooter;
let shiftModalBackground, shiftModalContent, shiftModalTitle, shiftModalBody, shiftModalCloseBtn, shiftDetailView, shiftAddForm;
let staffManageBtn, staffModalBackground, staffModalContent, staffModalCloseBtn, staffListContainer, addStaffForm;
// ★★★ スタッフ編集モーダル用の変数を追加 ★★★
let editStaffModalBackground, editStaffModalContent, editStaffForm, editStaffModalCloseBtn;


// =================================================================================
// --- 初期化 (Initialization) ---
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    setupEventListeners();
    buildShiftTable();
});

function initializeDOMElements() {
    // カレンダー & テーブル
    calendarTitle = document.getElementById("calendar-title");
    prevMonthBtn = document.getElementById("prev-month-btn");
    nextMonthBtn = document.getElementById("next-month-btn");
    todayBtn = document.getElementById("today-btn");
    tableHeader = document.getElementById("table-header");
    tableBody = document.getElementById("table-body");
    tableFooter = document.getElementById("table-footer");

    // シフト用モーダル
    shiftModalBackground = document.getElementById("modal-background");
    shiftModalContent = document.getElementById("modal-content");
    shiftModalTitle = document.getElementById("modal-title");
    shiftModalBody = document.getElementById("modal-body");
    shiftModalCloseBtn = document.getElementById("modal-close-btn");
    shiftDetailView = document.getElementById("shift-detail-view");
    shiftAddForm = document.getElementById("shift-add-form");

    // スタッフ管理用モーダル
    staffManageBtn = document.getElementById("staff-manage-btn");
    staffModalBackground = document.getElementById("staff-modal-background");
    staffModalContent = document.getElementById("staff-modal-content");
    staffModalCloseBtn = document.getElementById("staff-modal-close-btn");
    staffListContainer = document.getElementById("staff-list-container");
    addStaffForm = document.getElementById("add-staff-form");

    // ★★★ スタッフ編集モーダルの要素を取得 ★★★
    editStaffModalBackground = document.getElementById('edit-staff-modal-background');
    editStaffModalContent = document.getElementById('edit-staff-modal-content');
    editStaffForm = document.getElementById('edit-staff-form');
    editStaffModalCloseBtn = document.getElementById('edit-staff-modal-close-btn');
}

function setupEventListeners() {
    // カレンダーナビゲーション
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); buildShiftTable(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); buildShiftTable(); });
    todayBtn.addEventListener('click', () => { currentDate = new Date(); buildShiftTable(); });

    // モーダル関連
    shiftModalCloseBtn.addEventListener('click', closeShiftModal);
    shiftModalBackground.addEventListener('click', closeShiftModal);
    staffModalCloseBtn.addEventListener('click', closeStaffModal);
    staffModalBackground.addEventListener('click', closeStaffModal);

    // フォーム送信
    shiftAddForm.addEventListener('submit', handleShiftFormSubmit);
    addStaffForm.addEventListener('submit', handleAddStaff);
    
    // ボタンクリック
    staffManageBtn.addEventListener('click', openStaffModal);

    // イベント委任
    tableHeader.addEventListener('click', handleTableHeaderClick);
    tableBody.addEventListener('click', handleTableBodyClick);
    tableBody.addEventListener('change', handleTableBodyChange); // 個人目標入力の変更
    tableFooter.addEventListener('change', handleTableFooterChange);
}


// =================================================================================
// --- メイン描画処理 (Main Rendering) ---
// =================================================================================

async function buildShiftTable() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    calendarTitle.textContent = `${year}年 ${month}月`;
    tableBody.innerHTML = `<tr><td colspan="${33 + SUMMARY_ORDER.length}">読み込み中...</td></tr>`;
    tableFooter.innerHTML = '';

    const { staff, shifts } = await fetchData(year, month);
    
    currentStaff = staff;
    currentShifts = shifts;
    
    if (!staff || staff.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${33 + SUMMARY_ORDER.length}">スタッフデータがありません。</td></tr>`;
        return;
    }
    
    const shiftMap = transformShiftsToMap(shifts);
    const daysInMonth = new Date(year, month, 0).getDate();

    buildTableHeader(year, month, daysInMonth);
    buildTableBody(staff, shifts, shiftMap, year, month, daysInMonth);
    buildTableFooter(year, month, shifts, daysInMonth);
}

function buildTableHeader(year, month, daysInMonth) {
    let headerHTML = `<tr><th class="header-staff-col">氏名</th>`;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayClass = date.getDay() === 0 ? "day-sunday" : date.getDay() === 6 ? "day-saturday" : "";
        headerHTML += `<th class="${dayClass}">${day}<br>${weekdays[date.getDay()]}</th>`;
    }
    headerHTML += `<th class="summary-main-header"><div class="summary-header-container"><span>総時間</span><button id="accordion-toggle" class="accordion-toggle">${isAccordionOpen ? '−' : '+'}</button></div></th>`;
    
    SUMMARY_ORDER.forEach(key => {
        let headerContent = key;
        if (key === '休') {
            headerContent = `
                <div class="summary-header-container">
                    <button class="adjust-btn" data-type="休" data-amount="-1">−</button>
                    <span>休</span>
                    <button class="adjust-btn" data-type="休" data-amount="1">+</button>
                </div>
            `;
        }
        const visibilityClass = isAccordionOpen ? 'visible' : '';
        headerHTML += `<th class="summary-detail-header ${visibilityClass}">${headerContent}</th>`;
    });
    tableHeader.innerHTML = headerHTML + `</tr>`;
}

function buildTableBody(staff, shifts, shiftMap, year, month, daysInMonth) {
    let bodyHTML = "";
    staff.forEach(staffMember => {
        const summary = calculateSummary(shifts.filter(s => s.staff_name === staffMember.name));
        bodyHTML += `<tr><td class="staff-name-col">${staffMember.name}</td>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shiftData = shiftMap[staffMember.name]?.[dateStr];
            if (shiftData) {
                bodyHTML += `<td class="shift-cell has-shift" data-shift-id="${shiftData.id}">${shiftData.shift_type}</td>`;
            } else {
                bodyHTML += `<td class="shift-cell empty-cell" data-date="${dateStr}" data-staff-id="${staffMember.id}" data-staff-name="${staffMember.name}"></td>`;
            }
        }
        const totalHours = summary['日勤時間数'] + summary['夜勤時間数'];
        bodyHTML += `<td class="summary-main-col">${totalHours}h</td>`;
        
        const targetHolidays = staffTargetHolidays[staffMember.id] || globalTargetHolidays['休'];
        
        SUMMARY_ORDER.forEach(key => {
            const visibilityClass = isAccordionOpen ? 'visible' : '';
            const value = summary[key] || 0;
            let cellContent = `${value}${key.includes('時間数') ? 'h' : ''}`;

            if (key === '休') {
                cellContent = `<input type="number" class="target-input" value="${targetHolidays}" data-staff-id="${staffMember.id}" data-type="休"> / ${value}`;
            }
            
            bodyHTML += `<td class="summary-detail-col ${visibilityClass}">${cellContent}</td>`;
        });
        bodyHTML += `</tr>`;
    });
    tableBody.innerHTML = bodyHTML;
}

function buildTableFooter(year, month, shifts, daysInMonth) {
    let footerHTML = '';

    DAILY_COUNT_TARGETS.forEach(shiftType => {
        footerHTML += `<tr><th class="summary-row-label">${shiftType}</th>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const requiredCount = requiredStaffing[dateStr]?.[shiftType] || 0;
            const actualCount = shifts.filter(s => s.date === dateStr && s.shift_type === shiftType).length;
            
            const dayClass = new Date(year, month - 1, day).getDay() === 0 ? "day-sunday" : "";
            const statusClass = actualCount < requiredCount ? 'staff-shortage' : actualCount > requiredCount ? 'staff-surplus' : '';

            footerHTML += `<td class="${dayClass}">
                <div class="staffing-cell ${statusClass}">
                    <input type="number" class="summary-row-input" value="${requiredCount}" min="0" data-date="${dateStr}" data-shift-type="${shiftType}">
                    <span class="actual-count">(${actualCount})</span>
                </div>
            </td>`;
        }
        footerHTML += `<td class="summary-main-col"></td>`;
        SUMMARY_ORDER.forEach(() => footerHTML += `<td class="summary-detail-col ${isAccordionOpen ? 'visible' : ''}"></td>`);
        footerHTML += `</tr>`;
    });

    footerHTML += `<tr><th class="summary-row-label">合計</th>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const totalCount = shifts.filter(s => s.date === dateStr && SHIFT_DEFINITIONS[s.shift_type]?.type.includes('work')).length;
        const dayClass = new Date(year, month - 1, day).getDay() === 0 ? "day-sunday" : "";
        footerHTML += `<td class="${dayClass}">${totalCount}</td>`;
    }
    footerHTML += `<td class="summary-main-col"></td>`;
    SUMMARY_ORDER.forEach(() => footerHTML += `<td class="summary-detail-col ${isAccordionOpen ? 'visible' : ''}"></td>`);
    footerHTML += `</tr>`;

    tableFooter.innerHTML = footerHTML;
}

// =================================================================================
// --- モーダル管理 (Modal Management) ---
// =================================================================================

function openShiftDetailModal(shift) {
    shiftAddForm.style.display = 'none';
    shiftDetailView.style.display = 'block';
    shiftModalTitle.textContent = `${shift.date} のシフト詳細`;
    shiftDetailView.innerHTML = `<p><strong>スタッフ:</strong> ${shift.staff_name}</p><p><strong>勤務:</strong> ${shift.shift_type}</p><p><strong>備考:</strong> ${shift.notes || 'なし'}</p><div class="modal-buttons"><button id="edit-shift-btn">編集</button><button id="delete-shift-btn" class="delete-btn">削除</button></div>`;
    
    document.getElementById('edit-shift-btn').onclick = () => openShiftEditModal(shift);
    document.getElementById('delete-shift-btn').onclick = async () => {
        if (confirm('このシフトを削除しますか？')) {
            if (await deleteShiftApi(shift.id)) {
                closeShiftModal();
                buildShiftTable();
            } else {
                alert('シフトの削除に失敗しました。');
            }
        }
    };
    
    shiftModalBackground.classList.add('is-visible');
    shiftModalContent.classList.add('is-visible');
}

function openShiftAddModal(staffId, staffName, date) {
    openShiftEditModal({ staff_id: staffId, staff_name: staffName, date: date, shift_type: '日1', notes: '' });
    shiftModalTitle.textContent = '新規シフト登録';
    shiftAddForm.dataset.shiftId = '';
}

function openShiftEditModal(shift) {
    shiftDetailView.style.display = 'none';
    shiftAddForm.style.display = 'block';
    shiftModalTitle.textContent = 'シフト編集';
    shiftAddForm.dataset.shiftId = shift.id || '';
    
    document.getElementById('form-staff-id').value = shift.staff_id;
    document.getElementById('form-staff-name').textContent = shift.staff_name;
    document.getElementById('form-date').textContent = shift.date;
    document.getElementById('form-shift-type').value = shift.shift_type;
    document.getElementById('form-notes').value = shift.notes || '';
    
    shiftModalBackground.classList.add('is-visible');
    shiftModalContent.classList.add('is-visible');
}

function closeShiftModal() {
    shiftModalBackground.classList.remove('is-visible');
    shiftModalContent.classList.remove('is-visible');
}

function openStaffModal() {
    renderStaffList();
    staffModalBackground.classList.add('is-visible');
    staffModalContent.classList.add('is-visible');
}

function closeStaffModal() {
    staffModalBackground.classList.remove('is-visible');
    staffModalContent.classList.remove('is-visible');
}

function renderStaffList() {
    let listHTML = '<ul>';
    currentStaff.forEach(staff => {
        listHTML += `<li>
            <span>
                <strong>${staff.name}</strong><br>
                <small>${staff.employment_type || '未設定'} / ${staff.gender || '未設定'} / ${staff.experience || '未設定'}</small>
            </span>
            <div>
                <button onclick="handleEditStaff(${staff.id})">編集</button>
                <button onclick="handleDeleteStaff(${staff.id})" class="delete-btn">削除</button>
            </div>
        </li>`;
    });
    listHTML += '</ul>';
    staffListContainer.innerHTML = listHTML;
}

function renderAvailabilityEditor(staff) {
    const editorContainer = document.getElementById('availability-editor-container');
    const matrixTable = document.getElementById('availability-matrix');
    document.getElementById('editor-staff-name').textContent = `${staff.name} の勤務可否設定`;

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const shiftTypes = ["早", "日1", "日2", "中", "遅", "夜", "明"];

    let html = '<thead><tr><th></th>';
    weekdays.forEach(day => html += `<th>${day}</th>`);
    html += '</tr></thead>';

    html += '<tbody>';
    shiftTypes.forEach(st => {
        html += `<tr><td>${st}</td>`;
        for (let dow = 0; dow < 7; dow++) {
            const availability = staff.availabilities?.find(a => a.day_of_week === dow && a.shift_type === st);
            const isAvailable = availability ? availability.is_available : true;

            html += `<td>
                <div class="availability-toggle ${isAvailable ? 'is-available' : ''}"
                     data-day-of-week="${dow}"
                     data-shift-type="${st}">
                </div>
            </td>`;
        }
        html += '</tr>';
    });
    html += '</tbody>';
    matrixTable.innerHTML = html;

    editorContainer.style.display = 'block';

    matrixTable.querySelectorAll('.availability-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('is-available');
        });
    });

    document.getElementById('save-availability-btn').onclick = async () => {
        const newAvailabilities = [];
        matrixTable.querySelectorAll('.availability-toggle').forEach(toggle => {
            newAvailabilities.push({
                day_of_week: parseInt(toggle.dataset.dayOfWeek, 10),
                shift_type: toggle.dataset.shiftType,
                is_available: toggle.classList.contains('is-available')
            });
        });
        
        const success = await updateStaffAvailabilitiesApi(staff.id, newAvailabilities);
        if (success) {
            alert('設定を保存しました。');
            editorContainer.style.display = 'none';
            await buildShiftTable();
            renderStaffList();
        } else {
            alert('設定の保存に失敗しました。');
        }
    };
    
    document.getElementById('cancel-availability-btn').onclick = () => {
        editorContainer.style.display = 'none';
    };
}


// =================================================================================
// --- イベントハンドラ (Event Handlers) ---
// =================================================================================

function handleTableHeaderClick(event) {
    if (event.target.id === 'accordion-toggle') {
        isAccordionOpen = !isAccordionOpen;
        buildShiftTable();
    }
    if (event.target.classList.contains('adjust-btn')) {
        const type = event.target.dataset.type;
        const amount = parseInt(event.target.dataset.amount, 10);
        globalTargetHolidays[type] += amount;
        staffTargetHolidays = {}; // 個別設定をリセット
        buildShiftTable();
    }
}

function handleTableBodyClick(event) {
    const cell = event.target.closest('td');
    if (!cell) return;

    if (cell.classList.contains('has-shift')) {
        const shiftId = parseInt(cell.dataset.shiftId, 10);
        const selectedShift = currentShifts.find(s => s.id === shiftId);
        if (selectedShift) openShiftDetailModal(selectedShift);
    } else if (cell.classList.contains('empty-cell')) {
        const { date, staffId, staffName } = cell.dataset;
        openShiftAddModal(staffId, staffName, date);
    }
}

function handleTableBodyChange(event) {
    if (event.target.classList.contains('target-input')) {
        const staffId = event.target.dataset.staffId;
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value)) {
            staffTargetHolidays[staffId] = value;
        }
    }
}

function handleTableFooterChange(event) {
    if (event.target.classList.contains('summary-row-input')) {
        const { date, shiftType } = event.target.dataset;
        const value = parseInt(event.target.value, 10);
        if (!requiredStaffing[date]) requiredStaffing[date] = {};
        requiredStaffing[date][shiftType] = isNaN(value) ? 0 : value;
        updateStaffingStatusStyle(event.target);
    }
}

async function handleShiftFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const shiftId = form.dataset.shiftId;
    const shiftData = {
        staff_id: document.getElementById('form-staff-id').value,
        date: document.getElementById('form-date').textContent,
        shift_type: document.getElementById('form-shift-type').value,
        notes: document.getElementById('form-notes').value
    };

    const success = shiftId ? await updateShiftApi(shiftId, shiftData) : await addShiftApi(shiftData);
    if (success) {
        closeShiftModal();
        buildShiftTable();
    } else {
        alert(`シフトの${shiftId ? '更新' : '登録'}に失敗しました。`);
    }
}

async function handleAddStaff(event) {
    event.preventDefault();
    const newName = document.getElementById('new-staff-name').value.trim();
    if (!newName) return;

    const staffData = {
        name: newName,
        gender: document.getElementById('new-staff-gender').value,
        employment_type: document.getElementById('new-staff-employment-type').value,
        experience: document.getElementById('new-staff-experience').value
    };
    
    if (await addStaffApi(staffData)) {
        addStaffForm.reset();
        await buildShiftTable();
        renderStaffList();
    } else {
        alert('スタッフの追加に失敗しました。');
    }
}

// ★★★ handleEditStaff 関数をモーダルを使うように完全に書き換え ★★★
function handleEditStaff(staffId) {
    const staff = currentStaff.find(s => s.id === staffId);
    if (!staff) return;

    // フォームに現在の値をセット
    document.getElementById('edit-staff-id').value = staff.id;
    document.getElementById('edit-staff-name').value = staff.name;
    document.getElementById('edit-staff-gender').value = staff.gender || '';
    document.getElementById('edit-staff-employment-type').value = staff.employment_type || '';
    document.getElementById('edit-staff-experience').value = staff.experience || '';

    // モーダルを表示
    editStaffModalBackground.classList.add('is-visible');
    editStaffModalContent.classList.add('is-visible');

    // 閉じるボタンのイベントリスナーを設定
    editStaffModalCloseBtn.onclick = () => {
        editStaffModalBackground.classList.remove('is-visible');
        editStaffModalContent.classList.remove('is-visible');
    };
    editStaffModalBackground.onclick = () => {
        editStaffModalBackground.classList.remove('is-visible');
        editStaffModalContent.classList.remove('is-visible');
    };

    // フォーム送信時のイベントリスナーを設定
    editStaffForm.onsubmit = async (event) => {
        event.preventDefault();
        const updatedData = {
            name: document.getElementById('edit-staff-name').value,
            gender: document.getElementById('edit-staff-gender').value,
            employment_type: document.getElementById('edit-staff-employment-type').value,
            experience: document.getElementById('edit-staff-experience').value,
        };

        const success = await updateStaffApi(staff.id, updatedData);
        if (success) {
            // モーダルを閉じる
            editStaffModalBackground.classList.remove('is-visible');
            editStaffModalContent.classList.remove('is-visible');
            // テーブルを再描画
            await buildShiftTable();
            // スタッフ管理リストも再描画
            renderStaffList(); 
        } else {
            alert('スタッフ情報の更新に失敗しました。');
        }
    };
}


async function handleDeleteStaff(staffId) {
    if (confirm('このスタッフを本当に削除しますか？\n関連するシフトも全て削除されます。')) {
        if (await deleteStaffApi(staffId)) {
            await buildShiftTable();
            renderStaffList();
        } else {
            alert('スタッフの削除に失敗しました。');
        }
    }
}

// =================================================================================
// --- API通信 (API Communications) ---
// =================================================================================

async function fetchData(year, month) {
    try {
        const response = await fetch(`${GET_DATA_URL}?year=${year}&month=${month}`);
        if (!response.ok) throw new Error('API request failed');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return { staff: [], shifts: [] };
    }
}

async function addShiftApi(shiftData) { return await postData(ADD_SHIFT_URL, shiftData, 'Failed to add shift'); }
async function updateShiftApi(shiftId, shiftData) { return await postData(`${UPDATE_SHIFT_URL_TEMPLATE}${shiftId}`, shiftData, 'Failed to update shift', 'PUT'); }
async function deleteShiftApi(shiftId) { return await postData(`${DELETE_SHIFT_URL_TEMPLATE}${shiftId}`, null, 'Failed to delete shift', 'DELETE'); }
async function addStaffApi(staffData) { return await postData(ADD_STAFF_URL, staffData, 'Failed to add staff'); }
async function updateStaffApi(staffId, staffData) { return await postData(`${UPDATE_STAFF_URL_TEMPLATE}${staffId}`, staffData, 'Failed to update staff', 'PUT'); }
async function deleteStaffApi(staffId) { return await postData(`${DELETE_STAFF_URL_TEMPLATE}${staffId}`, null, 'Failed to delete staff', 'DELETE'); }
async function updateStaffAvailabilitiesApi(staffId, availabilities) {
    const url = `${UPDATE_STAFF_AVAILABILITIES_URL_TEMPLATE}${staffId}`;
    return await postData(url, availabilities, 'Failed to update availabilities', 'POST');
}


async function postData(url, data, errorMessage, method = 'POST') {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (data) options.body = JSON.stringify(data);
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message);
        }
        return true;
    } catch (error) {
        console.error(errorMessage, error);
        return false;
    }
}

// =================================================================================
// --- ヘルパー関数 (Helper Functions) ---
// =================================================================================

function calculateSummary(staffShifts) {
    const summary = {};
    SUMMARY_ORDER.forEach(key => summary[key] = 0);
    staffShifts.forEach(shift => {
        const def = SHIFT_DEFINITIONS[shift.shift_type];
        if (def) {
            if (summary[shift.shift_type] !== undefined) summary[shift.shift_type]++;
            if (def.type === 'day_work') summary['日勤時間数'] += def.hours;
            else if (def.type === 'night_work') summary['夜勤時間数'] += def.hours;
        }
    });
    return summary;
}

function transformShiftsToMap(shifts) {
    const map = {};
    shifts.forEach(shift => {
        if (!map[shift.staff_name]) map[shift.staff_name] = {};
        map[shift.staff_name][shift.date] = shift;
    });
    return map;
}

function updateStaffingStatusStyle(inputElement) {
    const cellDiv = inputElement.parentElement;
    const requiredCount = parseInt(inputElement.value, 10);
    const actualCountText = cellDiv.querySelector('.actual-count').textContent;
    const actualCount = parseInt(actualCountText.replace(/[()]/g, ''), 10);
    
    cellDiv.classList.remove('staff-shortage', 'staff-surplus');
    if (actualCount < requiredCount) {
        cellDiv.classList.add('staff-shortage');
    } else if (actualCount > requiredCount) {
        cellDiv.classList.add('staff-surplus');
    }
}
