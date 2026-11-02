const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker } = require('wa-sticker-formatter');
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
    '!piqui': '🤖 *piqui* - Inteligência artificial e ferramentas inteligentes:\nhttps://endia.edgeone.app',
    '!conectatb': '🌐 *ConectaTB* - Portal e utilidades da comunidade:\nhttps://conectatb.base44.app',
    '!criador': '👨‍💻 Este bot foi desenvolvido por *CalzinnOfc* (Equipy PvpEnd)!',
    '!ping': 'Pong! 🏓 O bot está 100% online e respondendo na hora!',
    '!ajuda': '🤖 *Menu de Comandos:*\n\n' +
             '🔹 *Projetos:* !endmath, !endia, !conectatb\n' +
             '🔹 *Utilitários & Diversão:* !ping, !regras, !piada, !dado, !cafe\n' +
             '🖼️ *Figurinha:* Envie uma foto com a legenda *!s* (ou responda a uma foto com *!s*) para virar figurinha!',
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
        
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n========================================`);
                console.log(`CÓDIGO DE EMPARELHAMENTO: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.error('Erro ao gerar código:', err);
            }
        }, 4000);
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

    // Sistema de mensagens (Comandos + Criador de Figurinha !s)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const sender = m.key.remoteJid;
        const messageType = Object.keys(m.message)[0];

        // Identifica se é uma imagem direta com legenda "!s" ou texto respondendo a uma imagem com "!s"
        const isImage = messageType === 'imageMessage';
        const isExtendedText = messageType === 'extendedTextMessage';
        
        let caption = isImage ? m.message.imageMessage.caption : (isExtendedText ? m.message.extendedTextMessage.text : '');
        caption = caption ? caption.trim().toLowerCase() : '';

        // Se o comando for !s (Figurinha)
        if (caption === '!s') {
            try {
                let targetMessage = m;

                // Se mandou "!s" respondendo a uma foto enviada anteriormente
                if (isExtendedText && m.message.extendedTextMessage.contextInfo?.quotedMessage?.imageMessage) {
                    targetMessage = {
                        message: {
                            imageMessage: m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage
                        }
                    };
                } else if (!isImage) {
                    return; // Se não for imagem nem resposta a imagem com !s, ignora
                }

                console.log('Criando figurinha...');
                await sock.sendMessage(sender, { text: '⏳ Gerando figurinha...' }, { quoted: m });

                // Baixa a imagem enviada
                const mediaBuffer = await downloadMediaMessage(
                    targetMessage,
                    'buffer',
                    {},
                    { logger: pino({ level: 'silent' }) }
                );

                // Converte para WebP (Sticker)
                const sticker = new Sticker(mediaBuffer, {
                    pack: 'PvpEndRobot',
                    author: 'CalzinnOfc',
                    type: 'full', // 'full' ou 'crop'
                    categories: ['🤩'],
                    quality: 50
                });

                const stickerBuffer = await sticker.toBuffer();
                await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: m });
                console.log('Figurinha enviada com sucesso!');

            } catch (error) {
                console.error('Erro ao criar figurinha:', error);
                await sock.sendMessage(sender, { text: '❌ Erro ao criar a figurinha. Envie a foto com a legenda !s novamente!' }, { quoted: m });
            }
            return;
        }

        // Processa comandos normais de texto
        if (commands[caption]) {
            await sock.sendMessage(sender, { text: commands[caption] }, { quoted: m });
        }
    });
}

connectToWhatsApp();
               
