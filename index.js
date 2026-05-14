const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
require('dotenv').config();

const emojis = ['❤️', '🔥', '✨', '🙌', '💯', '🌸', '👗', '👑'];

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./database/auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Désactivé pour le code de couplage
        logger: pino({ level: "silent" }),
    });

    // --- LOGIQUE DE COUPLAGE PAR CODE ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.NUMERO_BOT;
        if (phoneNumber) {
            await delay(5000);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n========================================\n`);
            console.log(`TON CODE DE COUPLAGE : ${code}`);
            console.log(`\n========================================\n`);
        }
    }

    // --- LIKER LES STATUTS AUTOMATIQUEMENT ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m.message) return;

        // Détection de statut
        if (m.key.remoteJid === 'status@broadcast') {
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            await sock.sendMessage(m.key.remoteJid, { react: { text: randomEmoji, key: m.key } }, { statusJidList: [m.key.participant] });
            console.log(`Statut liké avec : ${randomEmoji}`);
        }

        // --- GESTION DES COMMANDES (.menu, .settings, etc.) ---
        const messageText = m.message.conversation || m.message.extendedTextMessage?.text;
        if (messageText?.startsWith('.')) {
            const command = messageText.slice(1).toLowerCase();
            
            switch(command) {
                case 'menu':
                    await sock.sendMessage(m.key.remoteJid, { text: "👗 *MENU TATIANA COUTURE*\n\n1. .shop (Articles)\n2. .expo (Confections)\n3. .order (Commander)\n4. .settings (Paramètres)" });
                    break;
                case 'msgn':
                    await sock.sendMessage(m.key.remoteJid, { text: "🔍 Vérification des messages non lus en cours..." });
                    break;
                case 'settings':
                    await sock.sendMessage(m.key.remoteJid, { text: "⚙️ *PARAMÈTRES*\n\n- Profil : Actif\n- Like Statut : Aléatoire\n- Auto-réponse : ON" });
                    break;
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();
