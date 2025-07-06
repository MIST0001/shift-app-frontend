// --- 設定 ---
const API_URL_BASE = "https://shift-app-api-xgls.onrender.com"; // ★あなたのベースURL
const GET_DATA_URL = `${API_URL_BASE}/api/shift-data`;
const ADD_SHIFT_URL = `${API_URL_BASE}/api/shifts/add`;
const UPDATE_SHIFT_URL_TEMPLATE = `${API_URL_BASE}/api/shifts/update/`; // IDを後から付ける
const YEAR = 2025;
const MONTH = 7;

// --- DOM要素の取得 ---
let tableHeader, tableBody, modalBackground, modalContent, modalTitle, modalBody, modalCloseBtn, shiftDetailView, shiftAddForm;

// --- グローバル変数 ---
let currentShifts = []; // 現在のシフトデータを保持する

// --- 初期化 & メイン処理 ---
document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    setupEventListeners();
    buildShiftTable();
});

function initializeDOMElements() {
    tableHeader = document.getElementById("table-header");
    tableBody = document.getElementById("table-body");
    modalBackground = document.getElementById("modal-background");
    modalContent = document.getElementById("modal-content");
    modalTitle = document.getElementById("modal-title");
    modalBody = document.getElementById("modal-body");
    modalCloseBtn = document.getElementById("modal-close-btn");
    shiftDetailView = document.getElementById("shift-detail-view");
    shiftAddForm = document.getElementById("shift-add-form");
}

function setupEventListeners() {
    modalCloseBtn.addEventListener('click', closeModal);
    modalBackground.addEventListener('click', closeModal);
    shiftAddForm.addEventListener('submit', handleFormSubmit);
}

async function buildShiftTable() {
    const { staff, shifts } = await fetchData();
    if (!staff || !shifts) {
        tableBody.innerHTML = `<tr><td><p>データがありません。バックエンドサーバーがスリープしているか、APIエラーの可能性があります。</p><p>サーバーURLに直接アクセスし、Renderのログを確認してください。</p></td></tr>`;
        return;
    }
    
    currentShifts = shifts; // 取得したシフトデータをグローバル変数に保存

    const shiftMap = transformShiftsToMap(shifts);
    const daysInMonth = new Date(YEAR, MONTH, 0).getDate();

    // 1. ヘッダーを生成
    let headerHTML = `<tr><th class="header-staff-col">氏名</th>`;
    let dayOfWeekHTML = `<tr><th class="header-staff-col"></th>`;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(YEAR, MONTH - 1, day);
        const dayOfWeek = date.getDay();
        const dayClass = dayOfWeek === 0 ? "day-sunday" : dayOfWeek === 6 ? "day-saturday" : "";
        headerHTML += `<th class="${dayClass}">${day}</th>`;
        dayOfWeekHTML += `<th class="${dayClass}">${weekdays[dayOfWeek]}</th>`;
    }
    tableHeader.innerHTML = headerHTML + `</tr>` + dayOfWeekHTML + `</tr>`;

    // 2. ボディ（スタッフの行）を生成
    let bodyHTML = "";
    staff.forEach(staffMember => {
        bodyHTML += `<tr><td class="staff-name-col">${staffMember.name}</td>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shiftData = shiftMap[staffMember.name]?.[dateStr];
            const dayClass = new Date(YEAR, MONTH - 1, day).getDay() === 0 ? "day-sunday" : new Date(YEAR, MONTH - 1, day).getDay() === 6 ? "day-saturday" : "";

            if (shiftData) {
                bodyHTML += `<td class="shift-cell has-shift ${dayClass}" data-shift-id="${shiftData.id}">${shiftData.shift_type}</td>`;
            } else {
                bodyHTML += `<td class="shift-cell empty-cell ${dayClass}" data-date="${dateStr}" data-staff-id="${staffMember.id}" data-staff-name="${staffMember.name}"></td>`;
            }
        }
        bodyHTML += `</tr>`;
    });
    tableBody.innerHTML = bodyHTML;

    // 3. クリックイベントを設定
    setupCellClickEvents();
}

// --- イベント設定関連の関数 ---
function setupCellClickEvents() {
    document.querySelectorAll('.has-shift').forEach(cell => {
        cell.addEventListener('click', (event) => {
            const shiftId = parseInt(event.target.dataset.shiftId, 10);
            const selectedShift = currentShifts.find(s => s.id === shiftId);
            if (selectedShift) openDetailModal(selectedShift);
        });
    });

    document.querySelectorAll('.empty-cell').forEach(cell => {
        cell.addEventListener('click', (event) => {
            const { date, staffId, staffName } = event.target.dataset;
            openAddModal(staffId, staffName, date);
        });
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const shiftId = form.dataset.shiftId; // 編集中のシフトIDを取得

    // 更新と新規で送信するデータ内容を分ける
    let success = false;
    if (shiftId) {
        // 更新の場合：shift_type と notes のみ
        const shiftData = {
            shift_type: document.getElementById('form-shift-type').value,
            notes: document.getElementById('form-notes').value,
        };
        success = await updateShiftData(shiftId, shiftData);
    } else {
        // 新規登録の場合：全ての情報
        const shiftData = {
            staff_id: document.getElementById('form-staff-id').value,
            date: document.getElementById('form-date').textContent,
            shift_type: document.getElementById('form-shift-type').value,
            notes: document.getElementById('form-notes').value,
        };
        success = await addShiftData(shiftData);
    }

    if (success) {
        closeModal();
        buildShiftTable();
    } else {
        alert(`シフトの${shiftId ? '更新' : '登録'}に失敗しました。`);
    }
}

// --- モーダル（ポップアップ）関連の関数 ---
function openDetailModal(shift) {
    shiftAddForm.style.display = 'none';
    shiftDetailView.style.display = 'block';
    modalTitle.textContent = `${shift.date} のシフト詳細`;

    // 詳細表示と編集ボタンを生成
    shiftDetailView.innerHTML = `
        <p><strong>スタッフ:</strong> ${shift.staff_name}</p>
        <p><strong>勤務種類:</strong> ${shift.shift_type}</p>
        <p><strong>備考:</strong> ${shift.notes || '特になし'}</p>
        <button id="edit-shift-btn" data-shift-id="${shift.id}">編集</button>
    `;
    
    // 動的に生成したボタンにイベントリスナーを設定
    document.getElementById('edit-shift-btn').addEventListener('click', () => {
        openEditModal(shift);
    });

    modalBackground.classList.add('is-visible');
    modalContent.classList.add('is-visible');
}

function openAddModal(staffId, staffName, date) {
    shiftDetailView.style.display = 'none';
    shiftAddForm.style.display = 'block';
    modalTitle.textContent = '新規シフト登録';
    
    shiftAddForm.dataset.shiftId = ''; // 新規登録なのでIDは空に
    
    document.getElementById('form-staff-name').textContent = staffName;
    document.getElementById('form-date').textContent = date;
    document.getElementById('form-staff-id').value = staffId;
    document.getElementById('form-shift-type').value = '日1'; // デフォルト値
    document.getElementById('form-notes').value = '';

    // ★★★ フォームのスタッフ名と日付の表示を制御 ★★★
    document.getElementById('form-staff-name').parentElement.style.display = 'block';
    document.getElementById('form-date').parentElement.style.display = 'block';

    modalBackground.classList.add('is-visible');
    modalContent.classList.add('is-visible');
}

function openEditModal(shift) {
    shiftDetailView.style.display = 'none';
    shiftAddForm.style.display = 'block';
    modalTitle.textContent = 'シフト編集';

    shiftAddForm.dataset.shiftId = shift.id; // フォームに編集対象のIDをセット

    // 編集時はスタッフ名と日付は表示だけで十分なので、フォーム内の要素はそのままに
    document.getElementById('form-staff-name').textContent = shift.staff_name;
    document.getElementById('form-date').textContent = shift.date;
    document.getElementById('form-shift-type').value = shift.shift_type;
    document.getElementById('form-notes').value = shift.notes || '';

    // ★★★ フォームのスタッフ名と日付の表示を制御 ★★★
    document.getElementById('form-staff-name').parentElement.style.display = 'block';
    document.getElementById('form-date').parentElement.style.display = 'block';
}

function closeModal() {
    modalBackground.classList.remove('is-visible');
    modalContent.classList.remove('is-visible');
}

// --- API通信関連の関数 ---
async function fetchData() {
    try {
        const response = await fetch(GET_DATA_URL);
        if (!response.ok) throw new Error('API request failed');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return {};
    }
}

async function addShiftData(shiftData) {
    try {
        const response = await fetch(ADD_SHIFT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shiftData),
        });
        if (!response.ok) throw new Error('API request failed');
        return true;
    } catch (error) {
        console.error('Failed to add shift:', error);
        return false;
    }
}

async function updateShiftData(shiftId, shiftData) {
    try {
        const response = await fetch(`${UPDATE_SHIFT_URL_TEMPLATE}${shiftId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shiftData),
        });
        if (!response.ok) throw new Error('API request failed');
        return true;
    } catch (error) {
        console.error('Failed to update shift:', error);
        return false;
    }
}

// --- データ変換ヘルパー ---
function transformShiftsToMap(shifts) {
    const map = {};
    shifts.forEach(shift => {
        if (!map[shift.staff_name]) {
            map[shift.staff_name] = {};
        }
        map[shift.staff_name][shift.date] = shift;
    });
    return map;
}
