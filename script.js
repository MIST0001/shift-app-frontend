// --- 設定 ---
const API_URL = "https://shift-app-api-xgls.onrender.com/api/shift-data"; // あなたのURL
const YEAR = 2025;
const MONTH = 7;

// --- DOM要素の取得 ---
// この変数はグローバルスコープで宣言し、DOM読み込み後に初期化する
let tableHeader, tableBody, modalBackground, modalContent, modalTitle, modalBody, modalCloseBtn;

// --- メイン処理 ---
async function buildShiftTable() {
    // DOM要素の初期化
    tableHeader = document.getElementById("table-header");
    tableBody = document.getElementById("table-body");
    modalBackground = document.getElementById("modal-background");
    modalContent = document.getElementById("modal-content");
    modalTitle = document.getElementById("modal-title");
    modalBody = document.getElementById("modal-body");
    modalCloseBtn = document.getElementById("modal-close-btn");

    // イベントリスナーの設定
    modalCloseBtn.addEventListener('click', closeModal);
    modalBackground.addEventListener('click', closeModal);

    const { staff, shifts } = await fetchData();
    if (!staff || !shifts) {
        tableBody.innerHTML = `<tr><td><p>データがありません。または、バックエンドサーバーがスリープしている可能性があります。</p><p>サーバーのURLに直接アクセスして、数回リロードしてみてください。</p></td></tr>`;
        return;
    }

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
    headerHTML += `</tr>`;
    dayOfWeekHTML += `</tr>`;
    tableHeader.innerHTML = headerHTML + dayOfWeekHTML;

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
                bodyHTML += `<td class="${dayClass}"></td>`;
            }
        }
        bodyHTML += `</tr>`;
    });
    tableBody.innerHTML = bodyHTML;

    // 3. すべてのシフトセルにクリックイベントを設定
    document.querySelectorAll('.has-shift').forEach(cell => {
        cell.addEventListener('click', (event) => {
            const shiftId = parseInt(event.target.dataset.shiftId, 10);
            const selectedShift = shifts.find(s => s.id === shiftId);
            if (selectedShift) {
                openModal(selectedShift);
            }
        });
    });
}

// --- ヘルパー関数 ---
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            // サーバーからのエラーレスポンスの詳細をコンソールに出力
            const errorBody = await response.text();
            console.error(`API Error: ${response.status} ${response.statusText}`, errorBody);
            throw new Error('APIからのデータ取得に失敗しました');
        }
        return await response.json();
    } catch (error) {
        console.error("Fetch error:", error);
        return {}; // エラー時は空のオブジェクトを返す
    }
}

function transformShiftsToMap(shifts) {
    const map = {};
    shifts.forEach(shift => {
        if (!map[shift.staff_name]) {
            map[shift.staff_name] = {};
        }
        map[shift.staff_name][shift.date] = shift; // シフトオブジェクト全体を格納
    });
    return map;
}

function openModal(shift) {
    modalTitle.textContent = `${shift.date} のシフト詳細`;
    modalBody.innerHTML = `
        <p><strong>スタッフ:</strong> ${shift.staff_name}</p>
        <p><strong>勤務種類:</strong> ${shift.shift_type}</p>
        <p><strong>備考:</strong> ${shift.notes || '特になし'}</p>
    `;
    modalBackground.classList.add('is-visible');
    modalContent.classList.add('is-visible');
}

function closeModal() {
    modalBackground.classList.remove('is-visible');
    modalContent.classList.remove('is-visible');
}

// --- 実行 ---
// HTMLドキュメントが完全に読み込まれて準備ができてから、メインの処理を開始する
document.addEventListener('DOMContentLoaded', buildShiftTable);
