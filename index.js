const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker } = require('wa-sticker-formatter');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const QRCode = require('qrcode');
const pino = require('pino');
const http = require('http');

// Variáveis globais para exibir no painel web
let qrCodeImage = '';
let pairingCodeText = 'A gerar...';
let botStatus = '🔄 A iniciar bot e a ligar ao WhatsApp...';

// 🌐 PAINEL WEB NA PORTA DO RENDER
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="refresh" content="5">
            <title>Painel do Bot - Equipy PvpEnd</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; text-align: center; padding: 15px; margin: 0; }
                .card { background: #1e293b; max-width: 400px; margin: 20px auto; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
                h1 { color: #38bdf8; font-size: 20px; margin-top: 0; }
                .status { font-size: 15px; margin: 15px 0; padding: 10px; background: #334155; border-radius: 8px; }
                .code { font-size: 26px; font-weight: bold; letter-spacing: 3px; color: #4ade80; background: #09090b; padding: 12px; border-radius: 8px; margin: 15px 0; word-break: break-all; }
                img { background: #fff; padding: 8px; border-radius: 8px; max-width: 220px; margin: 15px 0; }
                p { color: #94a3b8; font-size: 13px; line-height: 1.4; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🤖 WhatsApp Bot</h1>
                <div class="status">${botStatus}</div>
                
                ${qrCodeImage ? `
                    <p>📸 Aponte a câmara do WhatsApp para este QR Code:</p>
                    <img src="${qrCodeImage}" alt="QR Code WhatsApp">
                ` : ''}

                ${pairingCodeText && pairingCodeText !== 'A gerar...' ? `
                    <p>🔢 Ou use o Código de Emparelhamento:</p>
                    <div class="code">${pairingCodeText}</div>
                ` : `<p>${pairingCodeText}</p>`}
                
                <p>🔄 Esta página atualiza automaticamente a cada 5 segundos.</p>
            </div>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Painel web ativo na porta ${PORT}`);
});

// 📌 COMANDOS DE TEXTO
const commands = {
    '!endmath': '🚀 *EndMath* - Treine sua velocidade em matemática!\n\nAcesse a plataforma oficial: https://endmath.base44.app\nDesenvolvido pela *Equipy PvpEnd*!',
    '!endia': '🤖 *EndIA* - Inteligência artificial e ferramentas inteligentes:\nhttps://endia.edgeone.app',
    '!conectatb': '🌐 *ConectaTB* - Portal e utilidades da comunidade:\nhttps://conectatb.base44.app',
    '!criador': '👨‍💻 Este bot foi desenvolvido por *CalzinnOfc* (Equipy PvpEnd)!',
    '!ping': 'Pong! 🏓 O bot está 100% online e respondendo na hora!',
    '!ajuda': '🤖 *Menu de Comandos:*\n🔹 *Projetos:* !endmath, !endia, !conectatb\n🔹 *Música:* !play [nome ou link]\n🔹 *Figurinha:* Envie foto com legenda *!s* ou *!p*\n🔹 *Utilitários:* !ping, !regras, !piada, !dado, !cafe',
    '!regras': '📜 *Regras do Grupo:*\n1. Respeite todos os membros.\n2. Proibido spam.',
    '!bot': '🤖 Estou rodando 24h na nuvem do Render!',
    '!piada': 'Por que o programador faliu? Porque usou todo o seu cache! 😂',
    '!dado': `🎲 Número tirado: *${Math.floor(Math.random() * 6) + 1}*`,
    '!cafe': '☕ *+50% de energia gerada!* Hora de programar!'
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Chrome'),
        syncFullHistory: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) qrCodeImage = url;
            });
            botStatus = '⚠️ Aguardando leitura do QR Code / Código';
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            botStatus = '⚠️ Ligação fechada. A reconectar...';
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            botStatus = '✅ Bot Conectado com Sucesso!';
            qrCodeImage = '';
            pairingCodeText = 'Conectado com sucesso!';
            console.log('Bot conectado com sucesso ao WhatsApp!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        const phoneNumber = "5544999295520";
        setTimeout(async () => {
            try {
                pairingCodeText = 'A solicitar código...';
                const code = await sock.requestPairingCode(phoneNumber);
                pairingCodeText = code;
                console.log(`CÓDIGO DE EMPARELHAMENTO: ${code}`);
            } catch (err) {
                pairingCodeText = 'Erro ao gerar (a tentar novamente...)';
            }
        }, 8000);
    }

    // GESTÃO DE MENSAGENS (COMANDOS, FIGURINHAS E MÚSICA)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const sender = m.key.remoteJid;
        const messageType = Object.keys(m.message)[0];
        const isImage = messageType === 'imageMessage';
        const isExtendedText = messageType === 'extendedTextMessage';
        const isConversation = messageType === 'conversation';
        
        let textBody = '';
        if (isConversation) textBody = m.message.conversation;
        else if (isExtendedText) textBody = m.message.extendedTextMessage.text;
        else if (isImage) textBody = m.message.imageMessage.caption;

        if (!textBody) return;
        const cleanText = textBody.trim();
        const lowerText = cleanText.toLowerCase();

        // 1. COMANDO DE FIGURINHA (!s ou !p)
        if (lowerText === '!s' || lowerText === '!p') {
            try {
                let targetMessage = m;
                if (isExtendedText && m.message.extendedTextMessage.contextInfo?.quotedMessage?.imageMessage) {
                    targetMessage = {
                        message: { imageMessage: m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage }
                    };
                } else if (!isImage) return;

                await sock.sendMessage(sender, { text: '⏳ A gerar figurinha...' }, { quoted: m });
                const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                const sticker = new Sticker(mediaBuffer, { pack: 'Equipy PvpEnd', author: 'CalzinnOfc', type: 'full', quality: 50 });
                const stickerBuffer = await sticker.toBuffer();
                await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: m });
            } catch (error) {
                console.error('Erro ao criar figurinha:', error);
                await sock.sendMessage(sender, { text: '❌ Erro ao criar a figurinha.' }, { quoted: m });
            }
            return;
        }

        // 2. COMANDO DE MÚSICA (!play)
        if (lowerText.startsWith('!play ')) {
            const query = cleanText.slice(6).trim();
            if (!query) return;
            try {
                await sock.sendMessage(sender, { text: `🔍 A procurar por: *${query}*...` }, { quoted: m });
                let videoUrl = query;
                let videoDetails;
                if (!ytdl.validateURL(query)) {
                    const searchResult = await yts(query);
                    if (!searchResult || searchResult.videos.length === 0) {
                        await sock.sendMessage(sender, { text: '❌ Nenhum vídeo encontrado.' }, { quoted: m });
                        return;
                    }
                    videoDetails = searchResult.videos[0];
                    videoUrl = videoDetails.url;
                } else {
                    videoDetails = await yts({ videoId: ytdl.getURLVideoID(query) });
                }

                await sock.sendMessage(sender, { text: `🎵 *${videoDetails.title}* (${videoDetails.timestamp})\n⏳ A baixar áudio...` }, { quoted: m });
                const audioStream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
                await sock.sendMessage(sender, { audio: audioStream, mimetype: 'audio/mp4', ptt: false }, { quoted: m });
            } catch (error) {
                console.error('Erro no !play:', error);
                await sock.sendMessage(sender, { text: '❌ Erro ao baixar o áudio.' }, { quoted: m });
            }
            return;
        }

        // 3. COMANDOS NORMAIS DE TEXTO
        if (commands[lowerText]) {
            await sock.sendMessage(sender, { text: commands[lowerText] }, { quoted: m });
        }
    });
}

connectToWhatsApp();
                
