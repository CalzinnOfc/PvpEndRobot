const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker } = require('wa-sticker-formatter');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const pino = require('pino');
const http = require('http');

// Servidor HTTP simples para manter a porta aberta no Render
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
    '!ajuda': '🤖 *Menu de Comandos:*\n\n' +
             '🔹 *Projetos:* !endmath, !endia, !conectatb\n' +
             '🔹 *Música:* *!play [nome ou link]* (Ex: !play fita isolante)\n' +
             '🔹 *Figurinha:* Envie foto com legenda *!s*\n' +
             '🔹 *Utilitários:* !ping, !regras, !piada, !dado, !cafe',
    '!regras': '📜 *Regras do Grupo:*\n1. Respeite todos os membros.\n2. Proibido spam.\n3. Divirta-se!',
    '!bot': '🤖 Estou rodando 24h na nuvem do Render, totalmente de graça!',
    '!piada': 'Por que o programador faliu? Porque ele usou todo o seu cache! 😂',
    '!dado': `🎲 Você tirou o número: *${Math.floor(Math.random() * 6) + 1}*`,
    '!cafe': '☕ *+50% de energia gerada!* Hora de programar!'
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Chrome')
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "5544999295520"; 
        
        // Espera 30 segundos para garantir que a ligação com o WhatsApp abriu com total estabilidade
        setTimeout(async () => {
            try {
                console.log('A solicitar código de emparelhamento...');
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n========================================`);
                console.log(`CÓDIGO DE EMPARELHAMENTO: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.error('Erro ao gerar código de emparelhamento:', err.message);
            }
        }, 30000); // 30 segundos exatos
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Bot conectado com sucesso!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Sistema de mensagens (Comandos, Figurinha !s e Player de Música !play)
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

        // 1. COMANDO DE FIGURINHA (!s)
        if (lowerText === '!s') {
            try {
                let targetMessage = m;
                if (isExtendedText && m.message.extendedTextMessage.contextInfo?.quotedMessage?.imageMessage) {
                    targetMessage = {
                        message: {
                            imageMessage: m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage
                        }
                    };
                } else if (!isImage) {
                    return;
                }

                await sock.sendMessage(sender, { text: '⏳ Gerando figurinha...' }, { quoted: m });
                
                const mediaBuffer = await downloadMediaMessage(
                    targetMessage,
                    'buffer',
                    {},
                    { logger: pino({ level: 'silent' }) }
                );

                const sticker = new Sticker(mediaBuffer, {
                    pack: 'Equipy PvpEnd Bot',
                    author: 'CalzinnOfc',
                    type: 'full',
                    categories: ['🤩'],
                    quality: 50
                });

                const stickerBuffer = await sticker.toBuffer();
                await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: m });
            } catch (error) {
                console.error('Erro ao criar figurinha:', error);
                await sock.sendMessage(sender, { text: '❌ Erro ao criar a figurinha. Tente novamente!' }, { quoted: m });
            }
            return;
        }

        // 2. COMANDO DE MÚSICA (!play)
        if (lowerText.startsWith('!play ')) {
            const query = cleanText.slice(6).trim();
            if (!query) {
                await sock.sendMessage(sender, { text: '❌ Digite o nome ou link de um vídeo após o !play.\nExemplo: `!play musica lofi`' }, { quoted: m });
                return;
            }

            try {
                await sock.sendMessage(sender, { text: `🔍 Buscando por: *${query}*...` }, { quoted: m });

                let videoUrl = query;
                let videoDetails;

                if (!ytdl.validateURL(query)) {
                    const searchResult = await yts(query);
                    if (!searchResult || searchResult.videos.length === 0) {
                        await sock.sendMessage(sender, { text: '❌ Nenhum vídeo encontrado com esse nome.' }, { quoted: m });
                        return;
                    }
                    videoDetails = searchResult.videos[0];
                    videoUrl = videoDetails.url;
                } else {
                    videoDetails = await yts({ videoId: ytdl.getURLVideoID(query) });
                }

                await sock.sendMessage(sender, { 
                    text: `🎵 *Música Encontrada!*\n\n*Título:* ${videoDetails.title}\n*Duração:* ${videoDetails.timestamp}\n*Canal:* ${videoDetails.author.name}\n\n⏳ Baixando áudio...` 
                }, { quoted: m });

                const audioStream = ytdl(videoUrl, {
                    quality: 'highestaudio',
                    filter: 'audioonly'
                });

                await sock.sendMessage(sender, { 
                    audio: audioStream, 
                    mimetype: 'audio/mp4',
                    ptt: false 
                }, { quoted: m });

            } catch (error) {
                console.error('Erro no comando !play:', error);
                await sock.sendMessage(sender, { text: '❌ Ocorreu um erro ao baixar o áudio deste vídeo.' }, { quoted: m });
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
            
