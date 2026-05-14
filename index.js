const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, onValue, get, child } = require("firebase/database");
const pino = require("pino");
require('dotenv').config();

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DB_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    appId: process.env.FIREBASE_APP_ID
};
const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

const emojis = ['❤️', '🔥', '✨', '🙌', '💯', '🌸', '👗', '👑', '💎', '🤩'];

async function startBot() {
    // Utilisation du dossier database/ pour la session
    const { state, saveCreds } = await useMultiFileAuthState('./database/auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Tatiana Couture", "Chrome", "1.0.0"]
    });

    // --- COUPLAGE PAR CODE ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.NUMERO_BOT;
        if (phoneNumber) {
            await delay(5000);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n========================================`);
            console.log(`👉 TON CODE DE COUPLAGE : ${code}`);
            console.log(`========================================\n`);
        }
    }

    // --- ÉCOUTEUR D'ORDRES (DASHBOARD -> BOT) ---
    const ordersRef = ref(db, 'bot/orders');
    onValue(ordersRef, async (snapshot) => {
        const order = snapshot.val();
        if (order && order.type === 'UPDATE_PROFILE') {
            console.log("📥 Ordre reçu : Mise à jour du profil...");
            try {
                if (order.name) await sock.updateProfileName(order.name);
                if (order.bio) await sock.updateProfileStatus(order.bio);
                console.log("✅ Profil mis à jour avec succès !");
            } catch (err) {
                console.error("❌ Erreur lors de la mise à jour :", err);
            }
        }
    });

    // --- GESTION DES ÉVÉNEMENTS MESSAGES ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m.message || m.key.fromMe) return;

        const remoteJid = m.key.remoteJid;
        const msgText = m.message.conversation || m.message.extendedTextMessage?.text || "";

        // 1. Réaction automatique aux statuts
        if (remoteJid === 'status@broadcast') {
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            await sock.sendMessage(remoteJid, { 
                react: { text: randomEmoji, key: m.key } 
            }, { statusJidList: [m.key.participant] });
            return;
        }

        // 2. Traitement des commandes commençant par "."
        if (msgText.startsWith('.')) {
            const command = msgText.slice(1).toLowerCase().trim();

            // Commandes Système
            if (command === 'menu') {
                const menu = `👗 *TATIANA COUTURE PRO*\n\n.shop - Boutique\n.expo - Confections\n.online - Statut\n.settings - Infos\n\n_Pilotez ce bot sur Undersand.page.dev_`;
                await sock.sendMessage(remoteJid, { text: menu });
            } 
            else if (command === 'online') {
                await sock.sendMessage(remoteJid, { text: "🟢 Le service est actuellement en ligne et prêt à vous servir." });
            }
            // Recherche de menu dynamique dans Firebase
            else {
                const dbRef = ref(getDatabase());
                get(child(dbRef, `menus/${command}`)).then(async (snapshot) => {
                    if (snapshot.exists()) {
                        await sock.sendMessage(remoteJid, { text: snapshot.val().text });
                    }
                }).catch((error) => {
                    console.error(error);
                });
            }
        }
    });

    // Gestion de la connexion (reconnexion automatique)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ Bot Tatiana Couture connecté et prêt !');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();