const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker } = require('wa-sticker-formatter');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const pino = require('pino');
const http = require('http');

// Servidor HTTP para manter o Render acordado
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot do WhatsApp ativo e rodando!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
});

// 📌 LISTA DE COMANDOS DE TEXTO
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
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. A reconectar...', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            }
        } else if (connection === 'open') {
            console.log('Bot conectado com sucesso ao WhatsApp!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Sistema inteligente com tentativas automáticas para o código de emparelhamento
    if (!sock.authState.creds.registered) {
        const phoneNumber = "5544999295520";
        
        const tentarPedirCodigo = async () => {
            try {
                console.log('A solicitar código de emparelhamento ao WhatsApp...');
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n========================================`);
                console.log(`CÓDIGO DE EMPARELHAMENTO: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.log('⚠️ Ligação ainda a estabilizar. Nova tentativa em 4 segundos...');
                setTimeout(tentarPedirCodigo, 4000); // Tenta de novo automaticamente se falhar
            }
        };

        // Aguarda 8 segundos iniciais e começa as tentativas automáticas
        setTimeout(tentarPedirCodigo, 8000);
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
