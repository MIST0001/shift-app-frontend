// Renderで公開したバックエンドAPIのURLに書き換える！
const API_URL = "https://shift-app-api.onrender.com"; 

async function fetchMessage() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // pタグのテキストを書き換える
        document.getElementById('message').textContent = data.message;

    } catch (error) {
        document.getElementById('message').textContent = "エラーが発生しました。";
        console.error(error);
    }
}

fetchMessage();
