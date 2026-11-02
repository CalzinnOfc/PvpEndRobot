const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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

// Conexão do WhatsApp (Baileys)
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

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

    // Ouvir mensagens recebidas
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const messageContent = m.message.conversation || m.message.extendedTextMessage?.text;
        const sender = m.key.remoteJid;

        if (!messageContent) return;

        console.log(`Mensagem recebida de ${sender}: ${messageContent}`);

        // Comandos de exemplo
        if (messageContent.toLowerCase() === '!ping') {
            await sock.sendMessage(sender, { text: 'Pong! 🏓 Bot online e respondendo na hora!' }, { quoted: m });
        }

        if (messageContent.toLowerCase() === '!ajuda') {
            await sock.sendMessage(sender, { text: 'Comandos disponíveis:\n- !ping\n- !ajuda' }, { quoted: m });
        }
    });
}

connectToWhatsApp();
