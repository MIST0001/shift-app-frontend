// --- 設定 ---
const API_URL = "https://shift-app-api-xgls.onrender.com/api/shift-data"; // ← あなたのURLに書き換える！
const YEAR = 2025;
const MONTH = 7;

// --- 要素の取得 ---
const tableHeader = document.getElementById("table-header");
const tableBody = document.getElementById("table-body");

// --- メイン処理 ---
async function buildShiftTable() {
    const { staff, shifts } = await fetchData();
    if (!staff || !shifts) return;

    // データを扱いやすい形に変換する（重要！）
    // {'田中 太郎': {'2025-07-01': '早', '2025-07-02': '夜'}, ...} のような形にする
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
        bodyHTML += `<tr>`;
        bodyHTML += `<td class="staff-name-col">${staffMember.name}</td>`; // スタッフ名列
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shiftType = shiftMap[staffMember.name]?.[dateStr] || ""; // シフトがあれば取得、なければ空文字

            const date = new Date(YEAR, MONTH - 1, day);
            const dayClass = date.getDay() === 0 ? "day-sunday" : date.getDay() === 6 ? "day-saturday" : "";

            bodyHTML += `<td class="${dayClass}">${shiftType}</td>`;
        }
        bodyHTML += `</tr>`;
    });
    tableBody.innerHTML = bodyHTML;
}

// --- ヘルパー関数 ---

// APIからデータを取得する関数
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('API Error');
        return await response.json();
    } catch (error) {
        console.error("Fetch error:", error);
        tableBody.innerHTML = `<tr><td>データ取得エラー</td></tr>`;
        return {};
    }
}

// シフトの配列を、検索しやすいマップ形式に変換する関数
function transformShiftsToMap(shifts) {
    const map = {};
    shifts.forEach(shift => {
        if (!map[shift.staff_name]) {
            map[shift.staff_name] = {};
        }
        map[shift.staff_name][shift.date] = shift.shift_type;
    });
    return map;
}

// --- 実行 ---
buildShiftTable();
